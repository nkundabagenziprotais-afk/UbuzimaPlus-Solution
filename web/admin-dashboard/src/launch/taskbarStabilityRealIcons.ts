/**
 * Permanent stable taskbar with real-life icons.
 * Keeps the dock visible after login, removes initials, prevents jumping,
 * and maps module labels to pharmacy/business SVG icons.
 */

type DockModule = {
  label: string;
  icon: string;
};

const DOCK_ID = "ubuzimaSourceDock";
const TIP_ID = "ubuzimaSourceDockTip";
const CACHE_KEY = "ubuzima.taskbar.realIconModules.v1";

function dockText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function cleanLabel(label: string): string {
  return label
    .replace(/\b[A-Z]{1,3}\b\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLoginScreen(): boolean {
  const body = dockText(document.body).toLowerCase();

  return Boolean(
    document.querySelector("input[type='password']") &&
      (document.querySelector("form") || body.includes("login") || body.includes("pin")),
  );
}

function isAuthenticatedSurface(): boolean {
  if (isLoginScreen()) return false;

  return Boolean(
    document.querySelector(".dashboard-shell") ||
      document.querySelector(".dashboard-main") ||
      document.querySelector("[data-admin-sidebar='true']") ||
      document.querySelector(".sidebar") ||
      document.querySelector("aside") ||
      document.querySelector("nav") ||
      document.getElementById(DOCK_ID),
  );
}

function iconForLabel(label: string): string {
  const value = label.toLowerCase();

  if (/\b(pos|counter|cashier|till|checkout)\b/.test(value)) return "/admin/dock-icons/pos.svg";
  if (/\b(product master|product setup|medicine|drug|catalog)\b/.test(value)) return "/admin/dock-icons/product-master.svg";
  if (/\b(inventory|product inventory|stock quantity|available stock)\b/.test(value)) return "/admin/dock-icons/inventory.svg";
  if (/\b(general stock|warehouse|store stock|stock room)\b/.test(value)) return "/admin/dock-icons/general-stock.svg";
  if (/\b(sales|sale|receipt|invoice)\b/.test(value)) return "/admin/dock-icons/sales.svg";
  if (/\b(procurement|purchase|purchasing|order)\b/.test(value)) return "/admin/dock-icons/procurement.svg";
  if (/\b(insurance|claim|claims|policy)\b/.test(value)) return "/admin/dock-icons/insurance.svg";
  if (/\b(supplier|vendor|delivery)\b/.test(value)) return "/admin/dock-icons/suppliers.svg";
  if (/\b(finance|payment|cash|bank|money|account)\b/.test(value)) return "/admin/dock-icons/finance.svg";
  if (/\b(report|analytics|dashboard report|statistics)\b/.test(value)) return "/admin/dock-icons/reports.svg";
  if (/\b(user|staff|employee|pharmacist|doctor|patient)\b/.test(value)) return "/admin/dock-icons/users.svg";
  if (/\b(admin|security|permission|role|access)\b/.test(value)) return "/admin/dock-icons/admin.svg";
  if (/\b(setting|configuration|preference)\b/.test(value)) return "/admin/dock-icons/settings.svg";
  if (/\b(pharmacy|clinic|dispensary)\b/.test(value)) return "/admin/dock-icons/pharmacy.svg";
  if (/\b(home|overview|dashboard)\b/.test(value)) return "/admin/dock-icons/dashboard.svg";

  return "/admin/dock-icons/module.svg";
}

function readButtonLabel(button: HTMLElement): string {
  const raw =
    button.getAttribute("aria-label") ||
    button.getAttribute("title") ||
    button.getAttribute("data-label") ||
    button.getAttribute("data-module") ||
    button.getAttribute("data-module-label") ||
    dockText(button);

  const label = cleanLabel(raw);

  if (label && label.length > 1 && !/^[A-Z]{1,3}$/.test(label)) return label;

  return button.getAttribute("data-ubuzima-full-label") || label || "Module";
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

function collectModules(): DockModule[] {
  const sidebar = findSidebar();
  if (!sidebar) return [];

  const seen = new Set<string>();
  const modules: DockModule[] = [];

  Array.from(sidebar.querySelectorAll<HTMLElement>("button, a, [role='button']")).forEach((node) => {
    const label = cleanLabel(dockText(node));

    if (!label || label.length < 2) return;
    if (/toggle|collapse|expand|logout|sign out|language|profile|sync|update/i.test(label)) return;

    const key = label.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    modules.push({
      label,
      icon: iconForLabel(label),
    });
  });

  return modules.slice(0, 60);
}

function writeCache(modules: DockModule[]): void {
  if (!modules.length) return;

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(modules));
    localStorage.setItem("ubuzima.taskbar.cachedModules.v1", JSON.stringify(modules));
  } catch {
    // ignore storage quota/private mode
  }
}

function readCache(): DockModule[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || localStorage.getItem("ubuzima.taskbar.cachedModules.v1") || "[]");

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.label === "string")
      .map((item) => ({
        label: cleanLabel(item.label),
        icon: typeof item.icon === "string" && item.icon ? item.icon : iconForLabel(item.label),
      }))
      .filter((item) => item.label)
      .slice(0, 60);
  } catch {
    return [];
  }
}

function resolveLiveModule(label: string): HTMLElement | null {
  const sidebar = findSidebar();
  if (!sidebar) return null;

  const key = label.toLowerCase();

  return (
    Array.from(sidebar.querySelectorAll<HTMLElement>("button, a, [role='button']")).find(
      (node) => cleanLabel(dockText(node)).toLowerCase() === key,
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

function ensureGlassIcon(button: HTMLElement, label: string): HTMLElement {
  let icon = button.querySelector<HTMLElement>(".ubuzima-source-dock__glass-icon");

  if (!icon) {
    icon = document.createElement("span");
    icon.className = "ubuzima-source-dock__glass-icon";
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon);
  }

  icon.textContent = "";

  let img = icon.querySelector<HTMLImageElement>("img");

  if (!img) {
    img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    icon.appendChild(img);
  }

  img.src = iconForLabel(label);
  img.setAttribute("data-ubuzima-real-icon", "true");

  return icon;
}

function bindButton(button: HTMLElement, label: string): void {
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("data-ubuzima-full-label", label);
  button.setAttribute("data-ubuzima-taskbar-real-icon", "true");

  ensureGlassIcon(button, label);

  button.style.setProperty("transform", "none", "important");
  button.style.setProperty("translate", "none", "important");
  button.style.setProperty("scale", "1", "important");

  if (button.getAttribute("data-ubuzima-taskbar-bound") === "true") return;

  button.setAttribute("data-ubuzima-taskbar-bound", "true");

  button.addEventListener("mouseenter", () => showTip(label, button));
  button.addEventListener("mouseleave", hideTip);
  button.addEventListener("focus", () => showTip(label, button));
  button.addEventListener("blur", hideTip);
}

function removeDuplicateDocks(): HTMLElement | null {
  const docks = Array.from(document.querySelectorAll<HTMLElement>(".ubuzima-source-dock, #" + DOCK_ID));

  if (!docks.length) return null;

  const primary =
    docks.find((dock) => dock.id === DOCK_ID) ||
    docks.find((dock) => dock.querySelector(".ubuzima-source-dock__main")) ||
    docks[0];

  primary.id = DOCK_ID;

  docks.forEach((dock) => {
    if (dock !== primary) dock.remove();
  });

  return primary;
}

function normalizeDock(dock: HTMLElement): void {
  dock.id = DOCK_ID;
  dock.classList.add("ubuzima-source-dock--stable-real-icons");
  dock.setAttribute("data-ubuzima-stable-taskbar", "true");

  dock.style.setProperty("display", "flex", "important");
  dock.style.setProperty("visibility", "visible", "important");
  dock.style.setProperty("opacity", "1", "important");
  dock.style.setProperty("transform", "translateX(-50%)", "important");

  Array.from(
    dock.querySelectorAll<HTMLElement>(
      ".ubuzima-source-dock__app, .ubuzima-source-dock__task, button, a[role='button']",
    ),
  ).forEach((button) => {
    if (button.closest(".ubuzima-source-dock__task-close, [aria-label*='close' i]")) return;

    const label = readButtonLabel(button);
    bindButton(button, label);
  });

  ensureTip();
}

function createFallbackDock(modules: DockModule[]): HTMLElement | null {
  if (!modules.length) return null;

  const existing = document.getElementById(DOCK_ID);
  if (existing) return existing;

  const dock = document.createElement("div");
  dock.id = DOCK_ID;
  dock.className = "ubuzima-source-dock ubuzima-source-dock--stable-real-icons";
  dock.setAttribute("data-ubuzima-stable-taskbar", "true");

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
    button.setAttribute("title", module.label);
    button.setAttribute("data-ubuzima-full-label", module.label);
    button.innerHTML = `<span class="ubuzima-source-dock__glass-icon" aria-hidden="true"><img src="${iconForLabel(module.label)}" alt="" loading="lazy" decoding="async" data-ubuzima-real-icon="true" /></span>`;

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

    bindButton(button, module.label);
    main?.appendChild(button);
  });

  document.body.appendChild(dock);
  return dock;
}

function stabilizeTaskbar(): void {
  if (isLoginScreen()) {
    document.querySelectorAll<HTMLElement>(".ubuzima-source-dock, #" + DOCK_ID).forEach((dock) => {
      dock.style.setProperty("display", "none", "important");
    });
    return;
  }

  if (!isAuthenticatedSurface()) return;

  const liveModules = collectModules();
  if (liveModules.length) writeCache(liveModules);

  const modules = liveModules.length ? liveModules : readCache();

  let dock = removeDuplicateDocks();

  if (!dock) {
    dock = createFallbackDock(modules);
  }

  if (dock) normalizeDock(dock);
}

function bootStableTaskbar(): void {
  stabilizeTaskbar();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(stabilizeTaskbar, 90);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden"],
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", schedule);
  window.setInterval(stabilizeTaskbar, 1000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootStableTaskbar);
  } else {
    bootStableTaskbar();
  }
}

export {};

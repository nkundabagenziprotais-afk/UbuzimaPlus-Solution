/**
 * UbuzimaPlus source-built launch dock.
 * Desktop/tablet Mac-style taskbar, safe side-effect module.
 * It never blocks React boot.
 */

type DockModule = {
  label: string;
  key: string;
  node: HTMLElement;
  icon: string;
};

const RECENT_KEY = "ubuzima.desktop.recentModules.v3";
const ACTIVE_KEY = "ubuzima.desktop.activeModule.v3";
const DOCK_ID = "ubuzimaSourceDock";
const TIP_ID = "ubuzimaSourceDockTip";
const RECOVERY_ID = "ubuzimaSourceUpdateRecovery";

function safeRun(callback: () => void): void {
  try {
    callback();
  } catch (error) {
    console.warn("[Ubuzima launch dock]", error);
  }
}

function textOf(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function safeLabel(value: string): string {
  return String(value || "").replace(/[<>&"]/g, "").trim();
}

function isDockDevice(): boolean {
  return window.innerWidth >= 768;
}

function isTablet(): boolean {
  return window.innerWidth >= 768 && window.innerWidth <= 1180;
}

function isDesktop(): boolean {
  return window.innerWidth >= 1181;
}

function isAuthenticatedView(): boolean {
  const bodyText = textOf(document.body).toLowerCase();
  const hasPassword = Boolean(document.querySelector('input[type="password"]'));

  if (hasPassword) return false;
  if (bodyText.includes("enter your staff phone") || bodyText.includes("pin")) return false;

  return Boolean(
    document.querySelector(".sidebar") ||
      document.querySelector('[data-admin-sidebar="true"]') ||
      document.querySelector('[class*="sidebar"]') ||
      document.querySelector("aside") ||
      document.querySelector("nav")
  );
}

function findSidebar(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('[data-admin-sidebar="true"]') ||
    document.querySelector<HTMLElement>(".sidebar") ||
    document.querySelector<HTMLElement>('[class*="sidebar"]') ||
    document.querySelector<HTMLElement>("aside") ||
    document.querySelector<HTMLElement>("nav")
  );
}

function iconForLabel(label: string): string {
  const value = label.toLowerCase();

  if (value.includes("pos") || value.includes("counter")) return "/admin/dock-icons/pos.svg";
  if (value.includes("sales")) return "/admin/dock-icons/sales.svg";
  if (value.includes("general stock")) return "/admin/dock-icons/general-stock.svg";
  if (value.includes("inventory") || value.includes("stock") || value.includes("product")) return "/admin/dock-icons/inventory.svg";
  if (value.includes("procurement") || value.includes("purchase")) return "/admin/dock-icons/procurement.svg";
  if (value.includes("insurance")) return "/admin/dock-icons/insurance.svg";
  if (value.includes("supplier")) return "/admin/dock-icons/suppliers.svg";
  if (value.includes("finance") || value.includes("payment") || value.includes("cash")) return "/admin/dock-icons/finance.svg";
  if (value.includes("report") || value.includes("analytics")) return "/admin/dock-icons/reports.svg";
  if (value.includes("admin") || value.includes("security") || value.includes("access")) return "/admin/dock-icons/admin.svg";
  if (value.includes("home") || value.includes("dashboard") || value.includes("overview")) return "/admin/dock-icons/dashboard.svg";

  return "/admin/dock-icons/module.svg";
}

function collectModules(): DockModule[] {
  const sidebar = findSidebar();
  if (!sidebar) return [];

  const controls = Array.from(
    sidebar.querySelectorAll<HTMLElement>('button, a, [role="button"]')
  );

  const seen = new Set<string>();
  const modules: DockModule[] = [];

  controls.forEach((node) => {
    const label = safeLabel(textOf(node));

    if (!label || label.length < 2) return;
    if (/toggle|collapse|expand|logout|sign out|language|profile|sync/i.test(label)) return;

    const key = label.toLowerCase();

    if (seen.has(key)) return;
    seen.add(key);

    modules.push({
      label,
      key,
      icon: iconForLabel(label),
      node,
    });
  });

  return modules.slice(0, 40);
}

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(value) ? value.filter(Boolean).slice(0, 10) : [];
  } catch {
    return [];
  }
}

function writeRecent(label: string): void {
  const clean = safeLabel(label);
  if (!clean) return;

  const recent = readRecent().filter(
    (item) => item.toLowerCase() !== clean.toLowerCase()
  );

  recent.unshift(clean);

  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
    localStorage.setItem(ACTIVE_KEY, clean);
  } catch {
    // ignore storage issues
  }
}

function closeRecent(label: string): void {
  const clean = safeLabel(label);

  try {
    const recent = readRecent().filter(
      (item) => item.toLowerCase() !== clean.toLowerCase()
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));

    if ((localStorage.getItem(ACTIVE_KEY) || "").toLowerCase() === clean.toLowerCase()) {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // ignore
  }

  renderDock();
}

function getActiveLabel(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || "";
  } catch {
    return "";
  }
}

function showTip(label: string, button: HTMLElement): void {
  const tip = document.getElementById(TIP_ID);
  if (!tip) return;

  const rect = button.getBoundingClientRect();
  tip.textContent = label;
  tip.style.left = `${rect.left + rect.width / 2}px`;
  tip.classList.add("is-visible");
}

function hideTip(): void {
  document.getElementById(TIP_ID)?.classList.remove("is-visible");
}

function activateModule(module: DockModule): void {
  writeRecent(module.label);

  module.node.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    })
  );

  window.setTimeout(renderDock, 160);
}

function makeModuleButton(module: DockModule, className: string, closable: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", module.label);

  if (getActiveLabel().toLowerCase() === module.label.toLowerCase()) {
    button.classList.add("is-active");
  }

  button.innerHTML = `
    <span class="ubuzima-source-dock__glass-icon" aria-hidden="true"><img src="${module.icon}" alt="" loading="lazy" decoding="async" /></span>
    ${
      closable
        ? `<span class="ubuzima-source-dock__close" data-close-task="true" aria-hidden="true">×</span>`
        : ""
    }
  `;

  button.addEventListener("mouseenter", () => showTip(module.label, button));
  button.addEventListener("mouseleave", hideTip);
  button.addEventListener("focus", () => showTip(module.label, button));
  button.addEventListener("blur", hideTip);

  button.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;

    if (target?.closest("[data-close-task='true']")) {
      event.preventDefault();
      event.stopPropagation();
      closeRecent(module.label);
      return;
    }

    activateModule(module);
  });

  return button;
}

function removeDock(): void {
  document.getElementById(DOCK_ID)?.remove();
  document.getElementById(TIP_ID)?.remove();
}

async function updateToNewVersion(): Promise<void> {
  const status = document.createElement("div");
  status.className = "ubuzima-source-update-toast";
  status.textContent = "Updating to new version...";
  document.body.appendChild(status);

  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // ignore
    }
  }

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => {
          if (registration.scope.includes("/admin/")) {
            return registration.unregister();
          }

          return undefined;
        })
      );
    } catch {
      // ignore
    }
  }

  window.location.href = `/admin/?updated=1&release=${Date.now()}`;
}

function maybeShowUpdateRecovery(): void {
  window.setTimeout(() => {
    safeRun(() => {
      if (document.getElementById(RECOVERY_ID)) return;

      const bodyText = textOf(document.body).toLowerCase();
      const root = document.getElementById("root");

      const looksStuck =
        bodyText.includes("opening ubuzima") ||
        bodyText.includes("if this screen does not continue") ||
        (root && root.children.length <= 1 && bodyText.includes("loading"));

      if (!looksStuck) return;

      const panel = document.createElement("section");
      panel.id = RECOVERY_ID;
      panel.className = "ubuzima-source-update-recovery";
      panel.innerHTML = `
        <strong>Update available</strong>
        <span>The app is taking longer than expected. Update to the newest version and continue.</span>
        <button type="button">Update to new version</button>
      `;

      panel.querySelector("button")?.addEventListener("click", updateToNewVersion);
      document.body.appendChild(panel);
    });
  }, 9000);
}

function renderDock(): void {
  safeRun(() => {
    if (!isDockDevice() || !isAuthenticatedView()) {
      removeDock();
      return;
    }

    const modules = collectModules();

    if (!modules.length) {
      removeDock();
      return;
    }

    let dock = document.getElementById(DOCK_ID);

    if (!dock) {
      dock = document.createElement("div");
      dock.id = DOCK_ID;
      dock.className = "ubuzima-source-dock";
      dock.innerHTML = `
        <div class="ubuzima-source-dock__main" aria-label="Modules"></div>
        <div class="ubuzima-source-dock__divider"></div>
        <div class="ubuzima-source-dock__tasks" aria-label="Open tasks"></div>
      `;

      document.body.appendChild(dock);

      const tip = document.createElement("div");
      tip.id = TIP_ID;
      tip.className = "ubuzima-source-dock__tip";
      document.body.appendChild(tip);
    }

    dock.classList.toggle("ubuzima-source-dock--tablet", isTablet());
    dock.classList.toggle("ubuzima-source-dock--desktop", isDesktop());

    const main = dock.querySelector(".ubuzima-source-dock__main");
    const tasks = dock.querySelector(".ubuzima-source-dock__tasks");

    if (!main || !tasks) return;

    main.innerHTML = "";
    tasks.innerHTML = "";

    modules.forEach((module) => {
      main.appendChild(makeModuleButton(module, "ubuzima-source-dock__app", false));
    });

    readRecent().forEach((label) => {
      const module = modules.find(
        (item) => item.label.toLowerCase() === label.toLowerCase()
      );

      if (module) {
        tasks.appendChild(
          makeModuleButton(module, "ubuzima-source-dock__task", true)
        );
      }
    });
  });
}

function classifyRoleSurface(): void {
  safeRun(() => {
    const root = document.documentElement;
    const bodyText = textOf(document.body).toLowerCase();

    root.classList.remove("ubuzima-role-admin-owner", "ubuzima-role-staff");

    const isAdminOrOwner =
      bodyText.includes("admin center") ||
      bodyText.includes("owner business center") ||
      bodyText.includes("platform management") ||
      bodyText.includes("left menu appearance");

    root.classList.add(isAdminOrOwner ? "ubuzima-role-admin-owner" : "ubuzima-role-staff");
  });
}

function cleanupStaffLandingFilters(): void {
  safeRun(() => {
    const root = document.documentElement;

    if (!root.classList.contains("ubuzima-role-staff")) return;

    const moduleTerms = [
      "pos",
      "sales",
      "inventory",
      "general stock",
      "procurement",
      "insurance",
    ];

    const filterTerms = [
      "filter",
      "filters",
      "date range",
      "status",
      "category",
      "branch",
      "supplier",
      "payment method",
      "sort",
      "view by",
      "customize",
      "analytics view",
    ];

    const excludeTerms = [
      "checkout",
      "payment",
      "submit",
      "save",
      "confirm",
      "approve",
      "receive stock",
      "add product",
      "edit product",
      "search product",
      "customer",
      "quantity",
    ];

    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        "section, article, aside, form, div, header"
      )
    );

    candidates.forEach((node) => {
      if (node.closest("[data-ubuzima-staff-filter-hidden='true']")) return;

      const text = textOf(node).toLowerCase();
      if (!text || text.length > 1800) return;

      const isTargetModule = moduleTerms.some((term) => text.includes(term));
      const isFilterPanel = filterTerms.some((term) => text.includes(term));
      const isWorkflowControl = excludeTerms.some((term) => text.includes(term));

      if (!isTargetModule || !isFilterPanel || isWorkflowControl) return;

      const fieldCount = node.querySelectorAll("select, input, textarea").length;
      const buttonCount = node.querySelectorAll("button").length;

      if (fieldCount + buttonCount < 2) return;

      node.style.display = "none";
      node.setAttribute("data-ubuzima-staff-filter-hidden", "true");
    });
  });
}

function classifyDevice(): void {
  safeRun(() => {
    const root = document.documentElement;
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const height = window.innerHeight || document.documentElement.clientHeight || 0;
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    const standalone =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;

    root.classList.remove(
      "ubuzima-device-phone",
      "ubuzima-device-tablet",
      "ubuzima-device-desktop",
      "ubuzima-device-pwa",
      "ubuzima-device-browser"
    );

    root.classList.add(standalone ? "ubuzima-device-pwa" : "ubuzima-device-browser");

    if (width <= 767 || (coarse && Math.min(width, height) <= 767)) {
      root.classList.add("ubuzima-device-phone");
    } else if (width <= 1180 || (coarse && Math.min(width, height) <= 1024)) {
      root.classList.add("ubuzima-device-tablet");
    } else {
      root.classList.add("ubuzima-device-desktop");
    }
  });
}

function bootLaunchShell(): void {
  classifyDevice();
  classifyRoleSurface();
  renderDock();
  maybeShowUpdateRecovery();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      classifyDevice();
      classifyRoleSurface();
      renderDock();
    }, 220);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootLaunchShell);
  } else {
    bootLaunchShell();
  }
}

export {};

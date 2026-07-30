const UBUZIMA_DOCK_ID = "ubuzimaSourceDock";

function ubuzimaDockText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function ubuzimaDockLogin(): boolean {
  const text = ubuzimaDockText(document.body).toLowerCase();
  return Boolean(document.querySelector("input[type='password']") && (text.includes("login") || text.includes("pin") || document.querySelector("form")));
}

function ubuzimaIconFor(label: string): string {
  const value = label.toLowerCase();

  if (/\b(pos|counter|cashier|checkout|till)\b/.test(value)) return "./dock-icons/pos.svg";
  if (/\b(product master|medicine|drug|catalog)\b/.test(value)) return "./dock-icons/product-master.svg";
  if (/\b(inventory|product inventory|available stock)\b/.test(value)) return "./dock-icons/inventory.svg";
  if (/\b(general stock|warehouse|store stock)\b/.test(value)) return "./dock-icons/general-stock.svg";
  if (/\b(sales|sale|receipt|invoice)\b/.test(value)) return "./dock-icons/sales.svg";
  if (/\b(procurement|purchase|purchasing|order)\b/.test(value)) return "./dock-icons/procurement.svg";
  if (/\b(insurance|claim|policy)\b/.test(value)) return "./dock-icons/insurance.svg";
  if (/\b(report|analytics|statistics)\b/.test(value)) return "./dock-icons/reports.svg";
  if (/\b(admin|security|permission|role|access)\b/.test(value)) return "./dock-icons/admin.svg";
  if (/\b(setting|configuration)\b/.test(value)) return "./dock-icons/settings.svg";
  if (/\b(user|staff|pharmacist|patient)\b/.test(value)) return "./dock-icons/users.svg";
  if (/\b(home|overview|dashboard)\b/.test(value)) return "./dock-icons/dashboard.svg";

  return "./dock-icons/module.svg";
}

function ubuzimaNormalizeDockButton(button: HTMLElement): void {
  if (button.closest("[aria-label*='close' i], .ubuzima-source-dock__task-close")) return;

  const label =
    button.getAttribute("aria-label") ||
    button.getAttribute("title") ||
    button.getAttribute("data-ubuzima-full-label") ||
    ubuzimaDockText(button) ||
    "Module";

  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("data-ubuzima-full-label", label);
  button.setAttribute("data-ubuzima-taskbar-hardlock", "true");

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

  img.src = ubuzimaIconFor(label);
  img.setAttribute("data-ubuzima-real-icon", "true");

  button.style.setProperty("transform", "none", "important");
  button.style.setProperty("translate", "none", "important");
  button.style.setProperty("scale", "1", "important");
}

function ubuzimaHardLockTaskbar(): void {
  const docks = Array.from(document.querySelectorAll<HTMLElement>(".ubuzima-source-dock, #" + UBUZIMA_DOCK_ID));

  if (ubuzimaDockLogin()) {
    docks.forEach((dock) => dock.style.setProperty("display", "none", "important"));
    return;
  }

  const dock = docks.find((node) => node.id === UBUZIMA_DOCK_ID) || docks[0];

  if (!dock) return;

  dock.id = UBUZIMA_DOCK_ID;
  dock.classList.add("ubuzima-source-dock--hard-locked");
  dock.setAttribute("data-ubuzima-taskbar-hardlock", "true");

  dock.style.setProperty("display", "flex", "important");
  dock.style.setProperty("visibility", "visible", "important");
  dock.style.setProperty("opacity", "1", "important");
  dock.style.setProperty("transform", "translateX(-50%)", "important");

  docks.forEach((node) => {
    if (node !== dock) node.remove();
  });

  Array.from(dock.querySelectorAll<HTMLElement>(".ubuzima-source-dock__app, .ubuzima-source-dock__task, button, a[role='button']")).forEach(ubuzimaNormalizeDockButton);
}

function bootUbuzimaTaskbarHardLock(): void {
  ubuzimaHardLockTaskbar();

  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(ubuzimaHardLockTaskbar, 100);
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
  window.setInterval(ubuzimaHardLockTaskbar, 1000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootUbuzimaTaskbarHardLock);
  } else {
    bootUbuzimaTaskbarHardLock();
  }
}

export {};

type DockModule = {
  id: string;
  label: string;
  section: string;
  params?: Record<string, string>;
  icon: string;
};

const MODULES: DockModule[] = [
  { id: "pos", label: "POS & Sales", section: "pos", params: { pos: "pos" }, icon: "/admin/dock-icons/pos.svg" },
  { id: "inventory", label: "Inventory", section: "inventory", params: { inventory: "overview" }, icon: "/admin/dock-icons/inventory.svg" },
  { id: "supplier", label: "Procurement", section: "supplier", params: { supplier: "supplier-list" }, icon: "/admin/dock-icons/module.svg" },
  { id: "insurance", label: "Insurance", section: "insurance", params: { insurance: "overview" }, icon: "/admin/dock-icons/module.svg" },
  { id: "finance", label: "Finance", section: "finance", params: { finance: "overview" }, icon: "/admin/dock-icons/module.svg" },
  { id: "reports", label: "Reports", section: "reports", params: { reports: "overview" }, icon: "/admin/dock-icons/reports.svg" },
  { id: "ai", label: "AI", section: "ai", params: { ai: "model-registry" }, icon: "/admin/dock-icons/module.svg" },
  { id: "adminPanel", label: "Admin", section: "adminPanel", params: { adminPanel: "backend-api" }, icon: "/admin/dock-icons/module.svg" },
];

const RECENT_KEY = "ubuzima.sourceDock.recent.v5";

function textOf(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function hashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function currentSection(): string {
  return hashParams().get("section") || "pos";
}

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => MODULES.some((module) => module.id === id)).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]): void {
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 8)));
}

function remember(id: string): void {
  writeRecent([id, ...readRecent().filter((item) => item !== id)]);
}

function forget(id: string): void {
  writeRecent(readRecent().filter((item) => item !== id));
}

function openModule(module: DockModule): void {
  const params = hashParams();

  params.set("section", module.section);
  params.delete("scrollY");

  Object.entries(module.params || {}).forEach(([key, value]) => params.set(key, value));

  remember(module.id);
  window.location.hash = params.toString();
  window.setTimeout(applyDock, 80);
}

function iconSpan(module: DockModule): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "ubuzima-source-dock__glass-icon";
  span.setAttribute("aria-hidden", "true");
  span.setAttribute("data-ubuzima-dock-v5-icon", "true");

  const img = document.createElement("img");
  img.src = module.icon;
  img.alt = "";
  img.loading = "eager";
  img.decoding = "async";
  img.setAttribute("data-ubuzima-dock-icon-v5", "true");

  span.appendChild(img);
  return span;
}

function moduleButton(module: DockModule, task = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = task ? "ubuzima-source-dock__task" : "ubuzima-source-dock__app";
  button.setAttribute("aria-label", module.label);
  button.setAttribute("title", module.label);
  button.setAttribute("data-ubuzima-dock-v5-button", "true");
  button.setAttribute("data-module-id", module.id);

  button.appendChild(iconSpan(module));

  if (task) {
    const close = document.createElement("span");
    close.className = "ubuzima-source-dock__close";
    close.textContent = "×";
    close.setAttribute("data-close-task", "true");
    close.setAttribute("aria-hidden", "true");
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      forget(module.id);
      renderFallback();
    });
    button.appendChild(close);
  }

  button.addEventListener("click", () => openModule(module));
  return button;
}

function fallbackDock(): HTMLElement {
  let dock = document.getElementById("ubuzimaSourceDockV5");

  if (!dock) {
    dock = document.createElement("nav");
    dock.id = "ubuzimaSourceDockV5";
    dock.className = "ubuzima-source-dock ubuzima-source-dock--fallback-v5";
    dock.setAttribute("aria-label", "Module taskbar");
    document.body.appendChild(dock);
  }

  return dock;
}

function renderFallback(): void {
  const dock = fallbackDock();
  dock.innerHTML = "";

  const main = document.createElement("div");
  main.className = "ubuzima-source-dock__main";

  MODULES.forEach((module) => main.appendChild(moduleButton(module, false)));

  const divider = document.createElement("span");
  divider.className = "ubuzima-source-dock__divider";
  divider.setAttribute("aria-hidden", "true");

  const tasks = document.createElement("div");
  tasks.className = "ubuzima-source-dock__tasks";

  readRecent()
    .map((id) => MODULES.find((module) => module.id === id))
    .filter(Boolean)
    .forEach((module) => tasks.appendChild(moduleButton(module as DockModule, true)));

  dock.append(main, divider, tasks);
  updateActiveState();
}

function cleanLabel(raw: string): string {
  const value = raw.replace(/\s+/g, " ").trim();

  if (/pos/i.test(value)) return "POS & Sales";
  if (/inventory/i.test(value)) return "Inventory";
  if (/report/i.test(value)) return "Reports";
  if (/chat/i.test(value)) return "Pharmacist Chat";
  if (/notification/i.test(value)) return "Notifications";

  return value.replace(/^[A-Z]{2}(?=[A-Z])/, "") || "Module";
}

function iconForLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("pos")) return "/admin/dock-icons/pos.svg";
  if (lower.includes("inventory")) return "/admin/dock-icons/inventory.svg";
  if (lower.includes("report")) return "/admin/dock-icons/reports.svg";
  return "/admin/dock-icons/module.svg";
}

function decorateExistingDockButton(button: HTMLElement): void {
  if (/close/i.test(button.getAttribute("aria-label") || "")) return;

  const label = cleanLabel(button.getAttribute("aria-label") || button.getAttribute("title") || textOf(button) || "Module");

  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("data-ubuzima-dock-v5-button", "true");

  let icon =
    button.querySelector<HTMLElement>(".ubuzima-source-dock__glass-icon") ||
    button.querySelector<HTMLElement>(".ubuzima-source-dock__icon");

  if (!icon) {
    icon = document.createElement("span");
    icon.className = "ubuzima-source-dock__glass-icon";
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon);
  }

  if (!icon.querySelector('img[data-ubuzima-dock-icon-v5="true"]')) {
    icon.innerHTML = "";
    const img = document.createElement("img");
    img.src = iconForLabel(label);
    img.alt = "";
    img.loading = "eager";
    img.decoding = "async";
    img.setAttribute("data-ubuzima-dock-icon-v5", "true");
    icon.appendChild(img);
  }

  icon.setAttribute("data-ubuzima-dock-v5-icon", "true");
  button.style.setProperty("transform", "none", "important");
  button.style.setProperty("scale", "1", "important");
}

function updateActiveState(): void {
  const section = currentSection();

  document.querySelectorAll<HTMLElement>("[data-module-id]").forEach((button) => {
    const id = button.getAttribute("data-module-id") || "";
    const module = MODULES.find((item) => item.id === id);
    button.classList.toggle("is-active", module?.section === section);
  });
}

function applyDock(): void {
  const existing = document.querySelector<HTMLElement>(".ubuzima-source-dock:not(#ubuzimaSourceDockV5), #ubuzimaSourceDock");

  if (!existing) {
    if (!document.getElementById("ubuzimaSourceDockV5")) renderFallback();
  } else {
    existing
      .querySelectorAll<HTMLElement>("button, .ubuzima-source-dock__app, .ubuzima-source-dock__task")
      .forEach(decorateExistingDockButton);
  }

  document
    .querySelectorAll<HTMLElement>("#ubuzimaSourceDockV5 button, .ubuzima-source-dock button")
    .forEach(decorateExistingDockButton);

  updateActiveState();
}

function boot(): void {
  applyDock();

  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyDock, 120);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-label", "title"],
  });

  window.addEventListener("hashchange", schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("resize", schedule);
  window.setInterval(applyDock, 1500);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}

export {};

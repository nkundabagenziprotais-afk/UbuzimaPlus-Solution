function textOf(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function isMobilePwa(): boolean {
  return document.documentElement.classList.contains("ubuzima-mobile-pwa-active");
}

function expiryStateFromTile(tile: HTMLElement): string {
  const title = tile.getAttribute("title") || "";
  const daysMatch = title.match(/\/\s*(-?\d+)\s*d/i) || title.match(/(-?\d+)\s*(?:day|days)/i);
  const days = daysMatch ? Number(daysMatch[1]) : NaN;

  if (!Number.isFinite(days)) return "unknown";
  if (days <= 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  if (days <= 180) return "watch";
  return "safe";
}

function expiryDateFromTile(tile: HTMLElement): string {
  const title = tile.getAttribute("title") || "";
  return title.match(/Expiry:\s*([^/]+)/i)?.[1]?.trim() || "—";
}

function remainingDaysFromTile(tile: HTMLElement): string {
  const title = tile.getAttribute("title") || "";
  const days = title.match(/\/\s*(-?\d+)\s*d/i)?.[1];

  if (days) return `${days} days`;
  return title.match(/\/\s*([^/]+)$/)?.[1]?.trim() || "—";
}

function makeRow(className: string, label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = `ubuzima-pos-v3-row ubuzima-pos-v3-row--${className}`;

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  const valueNode = document.createElement("strong");
  valueNode.textContent = value || "—";

  row.append(labelNode, valueNode);
  return row;
}

function decorateProductTile(tile: HTMLElement): void {
  if (!tile.matches(".pos-product-tile-v16")) return;

  const name = textOf(tile.querySelector(".pos-product-card-name"));
  const price = textOf(tile.querySelector(".pos-product-card-price em"));
  const stock = textOf(tile.querySelector(".pos-product-card-stock strong"));

  if (!name || !price || !stock) return;

  const state = expiryStateFromTile(tile);

  tile.setAttribute("data-ubuzima-pos-v3", "true");
  tile.setAttribute("data-ubuzima-expiry-state", state);

  tile.querySelectorAll(".ubuzima-pos-v3-card").forEach((node) => node.remove());

  const card = document.createElement("div");
  card.className = "ubuzima-pos-v3-card";

  card.append(
    makeRow("name", "Product Name", name),
    makeRow("price", "Price", price),
    makeRow("stock", isMobilePwa() ? "Available Quantity" : "Stock Quantity", stock),
    makeRow("expiry", "Expiry Date", expiryDateFromTile(tile)),
    makeRow("days", "Remaining Days", remainingDaysFromTile(tile)),
  );

  tile.prepend(card);

  Array.from(tile.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (child === card) return;
    child.setAttribute("data-ubuzima-pos-v3-original", "hidden");
  });
}

function applyProductTiles(): void {
  document
    .querySelectorAll<HTMLElement>(".pos-drug-list--ten > .pos-product-tile-v16, .pos-drug-list--ten > button.pos-product-tile-v16")
    .forEach(decorateProductTile);
}

function cleanDockLabel(raw: string): string {
  const value = raw.replace(/\s+/g, " ").trim();

  if (/pos/i.test(value)) return "POS & Sales";
  if (/inventory/i.test(value)) return "Inventory";
  if (/report/i.test(value)) return "Reports";
  if (/chat/i.test(value)) return "Pharmacist Chat";
  if (/notification/i.test(value)) return "Notifications";

  return value.replace(/^[A-Z]{2}(?=[A-Z])/, "") || "Module";
}

function iconFor(label: string): string {
  const value = label.toLowerCase();

  if (value.includes("pos")) return "/admin/dock-icons/pos.svg";
  if (value.includes("inventory")) return "/admin/dock-icons/inventory.svg";
  if (value.includes("report")) return "/admin/dock-icons/reports.svg";

  return "/admin/dock-icons/module.svg";
}

function decorateDockButton(button: HTMLElement): void {
  if (/close/i.test(button.getAttribute("aria-label") || "")) return;

  const label = cleanDockLabel(
    button.getAttribute("aria-label") ||
      button.getAttribute("title") ||
      button.textContent ||
      "Module",
  );

  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.style.setProperty("transform", "none", "important");
  button.style.setProperty("scale", "1", "important");

  let icon =
    button.querySelector<HTMLElement>(".ubuzima-source-dock__glass-icon") ||
    button.querySelector<HTMLElement>(".ubuzima-source-dock__icon");

  if (!icon) {
    icon = document.createElement("span");
    icon.className = "ubuzima-source-dock__glass-icon";
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon);
  }

  icon.innerHTML = "";

  const img = document.createElement("img");
  img.src = iconFor(label);
  img.alt = "";
  img.loading = "eager";
  img.decoding = "async";
  img.setAttribute("data-ubuzima-dock-icon-v3", "true");

  icon.appendChild(img);
  icon.setAttribute("data-ubuzima-real-icon-v3", "true");
}

function applyDockIcons(): void {
  document
    .querySelectorAll<HTMLElement>(".ubuzima-source-dock button, .ubuzima-source-dock__app, .ubuzima-source-dock__task")
    .forEach(decorateDockButton);
}

function decorateQuantityDialog(dialog: HTMLElement): void {
  if (!dialog.matches(".pos-quantity-dialog")) return;

  dialog.classList.add("ubuzima-pos-dialog-v3");

  const quantity = dialog.querySelector<HTMLElement>(".pos-quantity-selling-unit-hero");
  const price = dialog.querySelector<HTMLElement>(".pos-quantity-price-override-card");

  quantity?.classList.add("ubuzima-pos-dialog-v3-quantity");
  price?.classList.add("ubuzima-pos-dialog-v3-price");

  let actions = dialog.querySelector<HTMLElement>(".ubuzima-pos-dialog-v3-actions");

  if (!actions) {
    actions = document.createElement("div");
    actions.className = "ubuzima-pos-dialog-v3-actions";
  }

  const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).filter((button) =>
    /cancel|add to cart/i.test(textOf(button)),
  );

  if (buttons.length) {
    buttons.forEach((button) => actions?.appendChild(button));
    dialog.appendChild(actions);
  }
}

function applyDialogs(): void {
  document.querySelectorAll<HTMLElement>(".pos-quantity-dialog").forEach(decorateQuantityDialog);
}

function applyAll(): void {
  applyProductTiles();
  applyDockIcons();
  applyDialogs();
}

function boot(): void {
  applyAll();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyAll, 100);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-label", "title"],
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", schedule);
  window.setInterval(applyAll, 1500);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}

export {};

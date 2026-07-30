function cleanText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function mobilePwa(): boolean {
  return document.documentElement.classList.contains("ubuzima-mobile-pwa-active");
}

function expiryState(tile: HTMLElement): string {
  const title = tile.getAttribute("title") || "";
  const match = title.match(/\/\s*(-?\d+)\s*d/i) || title.match(/(-?\d+)\s*(?:day|days)/i);
  const days = match ? Number(match[1]) : NaN;

  if (!Number.isFinite(days)) return "unknown";
  if (days <= 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  if (days <= 180) return "watch";
  return "safe";
}

function expiryDate(tile: HTMLElement): string {
  return (tile.getAttribute("title") || "").match(/Expiry:\s*([^/]+)/i)?.[1]?.trim() || "—";
}

function remainingDays(tile: HTMLElement): string {
  const title = tile.getAttribute("title") || "";
  const days = title.match(/\/\s*(-?\d+)\s*d/i)?.[1];
  return days ? `${days} days` : "—";
}

function makeRow(kind: string, label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = `ubuzima-pos-v4-row ubuzima-pos-v4-row--${kind}`;

  const labelNode = document.createElement("span");
  labelNode.className = "ubuzima-pos-v4-label";
  labelNode.textContent = label;

  const valueNode = document.createElement("strong");
  valueNode.className = "ubuzima-pos-v4-value";
  valueNode.textContent = value || "—";

  row.append(labelNode, valueNode);
  return row;
}

function decorateTile(tile: HTMLElement): void {
  if (!tile.matches(".pos-product-tile-v16")) return;

  const name = cleanText(tile.querySelector(".pos-product-card-name"));
  const price = cleanText(tile.querySelector(".pos-product-card-price em"));
  const stock = cleanText(tile.querySelector(".pos-product-card-stock strong"));

  if (!name || !price || !stock) return;

  const state = expiryState(tile);

  tile.setAttribute("data-ubuzima-pos-v4", "true");
  tile.setAttribute("data-ubuzima-expiry-state", state);

  tile.querySelectorAll(".ubuzima-pos-v3-card, .ubuzima-pos-v4-card").forEach((node) => node.remove());

  const card = document.createElement("div");
  card.className = "ubuzima-pos-v4-card";

  card.append(
    makeRow("name", "Product Name", name),
    makeRow("price", "Price", price),
    makeRow("stock", mobilePwa() ? "Available Quantity" : "Stock Quantity", stock),
    makeRow("expiry", "Expiry Date", expiryDate(tile)),
    makeRow("days", "Remaining Days", remainingDays(tile)),
  );

  tile.prepend(card);

  Array.from(tile.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (child === card) return;
    child.setAttribute("data-ubuzima-pos-v4-original", "hidden");
  });
}

function applyTiles(): void {
  document
    .querySelectorAll<HTMLElement>(".pos-drug-list--ten > .pos-product-tile-v16, .pos-drug-list--ten > button.pos-product-tile-v16")
    .forEach(decorateTile);
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

  const label = cleanDockLabel(button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "Module");

  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("data-ubuzima-dock-v4-button", "true");

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
  icon.setAttribute("data-ubuzima-dock-v4-icon", "true");

  const img = document.createElement("img");
  img.src = iconFor(label);
  img.alt = "";
  img.loading = "eager";
  img.decoding = "async";
  img.setAttribute("data-ubuzima-dock-icon-v4", "true");

  icon.appendChild(img);

  button.style.setProperty("transform", "none", "important");
  button.style.setProperty("scale", "1", "important");
}

function applyDock(): void {
  document
    .querySelectorAll<HTMLElement>(
      ".ubuzima-source-dock button, .ubuzima-source-dock__app, .ubuzima-source-dock__task, #ubuzimaSourceDock button, [class*='dock'] button",
    )
    .forEach(decorateDockButton);
}

function decorateDialog(dialog: HTMLElement): void {
  if (!dialog.matches(".pos-quantity-dialog")) return;

  dialog.classList.add("ubuzima-pos-dialog-v4");

  dialog.querySelector<HTMLElement>(".pos-quantity-selling-unit-hero")?.classList.add("ubuzima-pos-dialog-v4-quantity");
  dialog.querySelector<HTMLElement>(".pos-quantity-price-override-card")?.classList.add("ubuzima-pos-dialog-v4-price");

  let actions = dialog.querySelector<HTMLElement>(".ubuzima-pos-dialog-v4-actions");

  if (!actions) {
    actions = document.createElement("div");
    actions.className = "ubuzima-pos-dialog-v4-actions";
  }

  Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
    .filter((button) => /cancel|add to cart/i.test(cleanText(button)))
    .forEach((button) => actions?.appendChild(button));

  if (actions.children.length) dialog.appendChild(actions);
}

function applyDialogs(): void {
  document.querySelectorAll<HTMLElement>(".pos-quantity-dialog").forEach(decorateDialog);
}

function applyAll(): void {
  applyTiles();
  applyDock();
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

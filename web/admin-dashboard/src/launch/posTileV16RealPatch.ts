type ExpiryState = "expired" | "critical" | "warning" | "watch" | "safe" | "unknown";

const TILE_SELECTOR = [
  ".pos-drug-list--ten > .pos-product-tile-v16",
  ".pos-drug-list--ten > button.pos-product-tile-v16",
  ".pos-builder-product-panel > .pos-drug-list--ten > .pos-product-tile-v16",
  ".pos-builder-product-panel > .pos-drug-list--ten > button.pos-product-tile-v16",
].join(",");

function textOf(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function html(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isMobilePwa(): boolean {
  return document.documentElement.classList.contains("ubuzima-mobile-pwa-active");
}

function originalText(tile: HTMLElement): string {
  const clone = tile.cloneNode(true) as HTMLElement;

  clone.querySelectorAll(".ubuzima-real-pos-card").forEach((node) => node.remove());

  return textOf(clone);
}

function validProductTile(tile: HTMLElement): boolean {
  const raw = originalText(tile).toLowerCase();

  if (!raw) return false;
  if (/refresh stock|inventory loaded|open day|session required|cart|payment method|customer type/i.test(raw)) return false;

  return /\b(price|rwf|frw)\b/i.test(raw) && /\b(stock|qty|quantity|available)\b/i.test(raw);
}

function productName(tile: HTMLElement): string {
  const strong =
    Array.from(tile.querySelectorAll<HTMLElement>("strong")).find((node) => {
      const value = textOf(node);
      return value && !/\b(price|stock|qty|quantity|expiry|days|rwf|frw|available)\b/i.test(value);
    }) || tile.querySelector<HTMLElement>("h3");

  const explicit = textOf(strong).replace(/^product\s*name\s*/i, "").trim();

  if (explicit && explicit.length > 1) return explicit;

  const raw = originalText(tile);
  const beforeFields = raw.split(/\b(price|rwf|frw|stock|available|qty|quantity|expiry|expire|remaining|days)\b/i)[0];

  return beforeFields.replace(/^product\s*name\s*/i, "").trim() || "Product";
}

function priceValue(tile: HTMLElement): string {
  const raw = originalText(tile);

  return (
    raw.match(/(?:RWF|FRW)\s*[\d.,]+/i)?.[0] ||
    raw.match(/[\d.,]+\s*(?:RWF|FRW)/i)?.[0] ||
    "—"
  );
}

function stockValue(tile: HTMLElement): string {
  const raw = originalText(tile);

  return (
    raw.match(/(?:stock\s*quantity|stock|available\s*quantity|available|qty|quantity)[^\d-]*(-?[\d.,]+)/i)?.[1] ||
    "—"
  );
}

function expiryValue(tile: HTMLElement): string {
  const raw = originalText(tile);

  return (
    raw.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/)?.[0] ||
    raw.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)?.[0] ||
    "—"
  );
}

function daysValue(tile: HTMLElement): string {
  const raw = originalText(tile);

  return (
    raw.match(/-?\d+\s*(?:remaining\s*)?days?/i)?.[0] ||
    raw.match(/remaining\s*days?[^\d-]*-?\d+/i)?.[0] ||
    "—"
  );
}

function parseDays(tile: HTMLElement): number | null {
  const direct = Number(daysValue(tile).match(/-?\d+/)?.[0]);

  if (Number.isFinite(direct)) return direct;

  const expiry = expiryValue(tile);
  const dmy = expiry.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  const ymd = expiry.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const match = ymd || dmy;

  if (!match) return null;

  const year = ymd ? Number(match[1]) : Number(match[3]);
  const month = Number(match[2]);
  const day = ymd ? Number(match[3]) : Number(match[1]);
  const expiryDate = new Date(year, month - 1, day);

  if (!Number.isFinite(expiryDate.getTime())) return null;

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startExpiry = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());

  return Math.ceil((startExpiry.getTime() - startToday.getTime()) / 86400000);
}

function expiryState(tile: HTMLElement): ExpiryState {
  const days = parseDays(tile);

  if (days === null) return "unknown";
  if (days <= 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  if (days <= 180) return "watch";
  return "safe";
}

function renderTile(tile: HTMLElement): void {
  if (!validProductTile(tile)) return;

  const state = expiryState(tile);

  tile.setAttribute("data-ubuzima-real-pos-tile", "true");
  tile.setAttribute("data-ubuzima-expiry-state", state);

  tile.classList.remove(
    "product-expiry-expired",
    "product-expiry-critical",
    "product-expiry-warning",
    "product-expiry-watch",
    "product-expiry-safe",
  );
  tile.classList.add(`product-expiry-${state === "unknown" ? "safe" : state}`);

  tile.querySelectorAll(".ubuzima-real-pos-card").forEach((node) => node.remove());

  const card = document.createElement("div");
  card.className = "ubuzima-real-pos-card";
  card.innerHTML = `
    <div class="ubuzima-real-pos-card__row ubuzima-real-pos-card__row--name">
      <span>Product Name</span>
      <strong>${html(productName(tile))}</strong>
    </div>
    <div class="ubuzima-real-pos-card__row ubuzima-real-pos-card__row--price">
      <span>Price</span>
      <strong>${html(priceValue(tile))}</strong>
    </div>
    <div class="ubuzima-real-pos-card__row ubuzima-real-pos-card__row--stock">
      <span>${isMobilePwa() ? "Available Quantity" : "Stock Quantity"}</span>
      <strong>${html(stockValue(tile))}</strong>
    </div>
    <div class="ubuzima-real-pos-card__row ubuzima-real-pos-card__row--expiry">
      <span>Expiry Date</span>
      <strong>${html(expiryValue(tile))}</strong>
    </div>
    <div class="ubuzima-real-pos-card__row ubuzima-real-pos-card__row--days">
      <span>Remaining Days</span>
      <strong>${html(daysValue(tile))}</strong>
    </div>
  `;

  tile.prepend(card);

  Array.from(tile.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (child === card) return;
    child.setAttribute("data-ubuzima-real-pos-original", "hidden");
  });
}

function applyTiles(): void {
  document.querySelectorAll<HTMLElement>(TILE_SELECTOR).forEach(renderTile);
}

function boot(): void {
  applyTiles();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyTiles, 120);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
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
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}

export {};

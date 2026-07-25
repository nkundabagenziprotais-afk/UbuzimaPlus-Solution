function upText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function low(node: Element | null | undefined): string {
  return upText(node).toLowerCase();
}

function isMobilePwa(): boolean {
  return document.documentElement.classList.contains("ubuzima-mobile-pwa-active");
}

function isPosPage(): boolean {
  return Boolean(
    document.querySelector(".pos-counter-page") ||
      document.querySelector(".pos-product-stock-section") ||
      document.querySelector(".pos-product-grid") ||
      document.querySelector(".pos-drug-list") ||
      document.querySelector(".pos-drug-list--ten") ||
      document.querySelector(".retail-pos-grid"),
  );
}

function skipCard(card: HTMLElement): boolean {
  const text = low(card);

  if (!text) return true;
  if (/\b(refresh stock|inventory loaded|open day|closing mode|session required|cart|payment method|customer type|prescription|serve customer)\b/i.test(text)) return true;

  const hasProductSignal = /\b(price|rwf|frw)\b/i.test(text) && /\b(stock|qty|quantity|available)\b/i.test(text);
  return !hasProductSignal;
}

function candidateCards(): HTMLElement[] {
  if (!isPosPage()) return [];

  const selector = [
    ".pos-product-card",
    ".pos-product-tile",
    ".pos-product-tile-v16",
    ".pos-product-grid > *",
    ".pos-drug-list > *",
    ".pos-drug-list--ten > *",
    ".retail-pos-grid > *",
  ].join(",");

  const seen = new Set<HTMLElement>();

  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((card) => {
    if (seen.has(card)) return false;
    seen.add(card);
    if (card.querySelector(".pos-product-grid, .pos-drug-list, .pos-drug-list--ten")) return false;
    return !skipCard(card);
  });
}

function allRows(card: HTMLElement): HTMLElement[] {
  return Array.from(
    card.querySelectorAll<HTMLElement>(
      ".pos-product-card-name, .pos-product-card-info-row, .pos-product-card-metric, .pos-product-card-line, .pos-product-card-row, h3, strong, [class*='price'], [class*='stock'], [class*='available'], [class*='expiry'], [class*='days']",
    ),
  );
}

function classify(row: HTMLElement): "name" | "price" | "stock" | "expiry" | "days" | null {
  const hay = `${low(row)} ${String(row.className || "").toLowerCase()}`;

  if (/\b(remaining|days left|remaining days)\b/.test(hay)) return "days";
  if (/\b(expiry|expire|expiration|exp)\b/.test(hay)) return "expiry";
  if (/\b(stock|stock quantity|available|available quantity|qty|quantity)\b/.test(hay)) return "stock";
  if (/\b(price|unit price|selling price|rwf|frw|amount|rate)\b/.test(hay)) return "price";

  if (
    row.matches(".pos-product-card-name, h3") ||
    (row.tagName.toLowerCase() === "strong" && !/\b(price|stock|qty|expiry|days|rwf|frw|available)\b/i.test(upText(row)))
  ) {
    return "name";
  }

  return null;
}

function parseDays(card: HTMLElement): number | null {
  const text = upText(card);
  const explicit =
    text.match(/(-?\d+)\s*(?:remaining\s*)?days?/i) ||
    text.match(/remaining\s*days?[^\d-]*(-?\d+)/i) ||
    text.match(/days?\s*left[^\d-]*(-?\d+)/i);

  if (explicit) {
    const value = Number(explicit[1]);
    if (Number.isFinite(value)) return value;
  }

  const dmy = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  const ymd = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const match = ymd || dmy;

  if (!match) return null;

  const year = ymd ? Number(match[1]) : Number(match[3]);
  const month = Number(match[2]);
  const day = ymd ? Number(match[3]) : Number(match[1]);
  const expiry = new Date(year, month - 1, day);

  if (!Number.isFinite(expiry.getTime())) return null;

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());

  return Math.ceil((startExpiry.getTime() - startToday.getTime()) / 86400000);
}

function expiryState(card: HTMLElement): string {
  const days = parseDays(card);

  if (days === null) return "unknown";
  if (days <= 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "safe";
}

function decorateCard(card: HTMLElement): void {
  card.classList.add("ubuzima-pos-card-clean");
  card.setAttribute("data-ubuzima-pos-clean-card", "true");
  card.setAttribute("data-ubuzima-expiry-state", expiryState(card));

  const rows = allRows(card);

  rows.forEach((row) => {
    row.classList.remove(
      "ubuzima-pos-card-clean-row",
      "ubuzima-pos-card-clean-row--name",
      "ubuzima-pos-card-clean-row--price",
      "ubuzima-pos-card-clean-row--stock",
      "ubuzima-pos-card-clean-row--expiry",
      "ubuzima-pos-card-clean-row--days",
    );

    const type = classify(row);
    if (!type) return;

    row.classList.add("ubuzima-pos-card-clean-row", `ubuzima-pos-card-clean-row--${type}`);
  });

  card.classList.toggle("ubuzima-pos-card-clean--mobile", isMobilePwa());
}

function applyCards(): void {
  candidateCards().forEach(decorateCard);
}

function boot(): void {
  applyCards();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyCards, 120);
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

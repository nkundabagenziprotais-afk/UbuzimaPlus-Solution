type UbuzimaExpiryState = "expired" | "critical" | "warning" | "safe" | "unknown";

const UBUZIMA_POS_CARD_SELECTOR = [
  ".pos-product-card",
  ".pos-product-tile",
  ".pos-product-tile-v16",
  ".pos-product-grid button",
  ".pos-drug-list button",
].join(",");

function ubuzimaCardText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function ubuzimaCardLower(node: Element | null | undefined): string {
  return ubuzimaCardText(node).toLowerCase();
}

function ubuzimaEscapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ubuzimaIsMobilePwa(): boolean {
  return document.documentElement.classList.contains("ubuzima-mobile-pwa-active");
}

function ubuzimaIsPosSurface(): boolean {
  return Boolean(
    document.querySelector(".pos-counter-page") ||
      document.querySelector(".pos-product-stock-section") ||
      document.querySelector(".pos-product-grid") ||
      document.querySelector(".pos-drug-list") ||
      document.querySelector(".pos-drug-list--ten") ||
      document.querySelector(".retail-pos-grid"),
  );
}

function ubuzimaLooksLikeProductCard(card: HTMLElement): boolean {
  const text = ubuzimaCardLower(card);

  if (!text || text.length < 3) return false;

  return Boolean(
    card.matches(".pos-product-card, .pos-product-tile, .pos-product-tile-v16") ||
      card.closest(".pos-product-grid, .pos-drug-list, .pos-drug-list--ten") ||
      /\b(price|stock|available|quantity|expiry|expire|remaining|days|rwf|frw)\b/i.test(text),
  );
}

function ubuzimaFindField(card: HTMLElement, terms: string[]): HTMLElement | null {
  const nodes = Array.from(
    card.querySelectorAll<HTMLElement>(
      ".pos-product-card-info-row, .pos-product-card-metric, .pos-product-card-line, .pos-product-card-row, [class*='info'], [class*='metric'], [class*='price'], [class*='stock'], [class*='available'], [class*='expiry'], [class*='days']",
    ),
  ).filter((node) => !node.closest(".ubuzima-pos-card-canonical"));

  return (
    nodes.find((node) => {
      const haystack = `${ubuzimaCardLower(node)} ${node.className || ""}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    }) || null
  );
}

function ubuzimaCleanValue(raw: string, type: "price" | "stock" | "expiry" | "days"): string {
  let value = raw.replace(/\s+/g, " ").trim();

  if (type === "price") {
    const match =
      value.match(/(?:RWF|FRW)\s*[\d.,]+/i) ||
      value.match(/[\d.,]+\s*(?:RWF|FRW)/i) ||
      value.match(/[\d.,]+/);
    return match ? match[0].trim() : value.replace(/price|unit price|selling price|amount|rate|cost/gi, "").trim();
  }

  if (type === "stock") {
    const match =
      value.match(/(?:stock|available|qty|quantity)[^\d-]*(-?[\d.,]+)/i) ||
      value.match(/-?[\d.,]+/);
    return match ? match[1] || match[0] : value.replace(/stock|stock quantity|available quantity|available|qty|quantity/gi, "").trim();
  }

  if (type === "expiry") {
    const match = value.match(/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/);
    return match ? match[0] : value.replace(/expiry|expire|expiration|exp\.?/gi, "").trim();
  }

  const match =
    value.match(/-?\d+\s*(?:remaining\s*)?days?/i) ||
    value.match(/remaining\s*days?[^\d-]*-?\d+/i) ||
    value.match(/days?\s*left[^\d-]*-?\d+/i);
  return match ? match[0] : value.replace(/remaining|days left|remaining days|days/gi, "").trim();
}

function ubuzimaFallbackField(card: HTMLElement, type: "price" | "stock" | "expiry" | "days"): string {
  const text = ubuzimaCardText(card);

  if (type === "price") {
    return (
      text.match(/(?:RWF|FRW)\s*[\d.,]+/i)?.[0] ||
      text.match(/[\d.,]+\s*(?:RWF|FRW)/i)?.[0] ||
      ""
    );
  }

  if (type === "stock") {
    return (
      text.match(/(?:stock|available|qty|quantity)[^\d-]*(-?[\d.,]+)/i)?.[1] ||
      ""
    );
  }

  if (type === "expiry") {
    return text.match(/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/)?.[0] || "";
  }

  return (
    text.match(/-?\d+\s*(?:remaining\s*)?days?/i)?.[0] ||
    text.match(/remaining\s*days?[^\d-]*-?\d+/i)?.[0] ||
    ""
  );
}

function ubuzimaProductName(card: HTMLElement): string {
  const nameNode =
    card.querySelector<HTMLElement>(".pos-product-card-name") ||
    card.querySelector<HTMLElement>("h3") ||
    Array.from(card.querySelectorAll<HTMLElement>("strong")).find((node) => {
      return !/\b(price|stock|qty|expiry|days|rwf|frw|available)\b/i.test(ubuzimaCardText(node));
    }) ||
    null;

  const direct = ubuzimaCardText(nameNode);
  if (direct && direct.length > 1) return direct;

  const text = ubuzimaCardText(card);
  const beforeFields = text.split(/\b(price|stock|available|qty|quantity|expiry|expire|remaining|days|rwf|frw)\b/i)[0];

  return beforeFields.trim() || "Product";
}

function ubuzimaFieldValue(card: HTMLElement, type: "price" | "stock" | "expiry" | "days"): string {
  const terms = {
    price: ["price", "unit price", "selling price", "amount", "rate", "rwf", "frw"],
    stock: ["stock", "stock quantity", "available", "available quantity", "qty", "quantity"],
    expiry: ["expiry", "expire", "expiration", "exp"],
    days: ["remaining", "days", "days left", "remaining days"],
  }[type];

  const node = ubuzimaFindField(card, terms);
  const value = node ? ubuzimaCleanValue(ubuzimaCardText(node), type) : "";

  return value || ubuzimaFallbackField(card, type) || "—";
}

function ubuzimaParseDays(card: HTMLElement): number | null {
  const daysText = ubuzimaFieldValue(card, "days");
  const days = Number(daysText.match(/-?\d+/)?.[0]);

  if (Number.isFinite(days)) return days;

  const expiry = ubuzimaFieldValue(card, "expiry");
  const match = expiry.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/) || expiry.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  if (!match) return null;

  let year = 0;
  let month = 0;
  let day = 0;

  if (match[1].length === 4) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  const expiryDate = new Date(year, month - 1, day);
  if (!Number.isFinite(expiryDate.getTime())) return null;

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startExpiry = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());

  return Math.ceil((startExpiry.getTime() - startToday.getTime()) / 86400000);
}

function ubuzimaExpiryState(card: HTMLElement): UbuzimaExpiryState {
  const days = ubuzimaParseDays(card);

  if (days === null) return "unknown";
  if (days <= 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "safe";
}

function ubuzimaEnsurePlus(card: HTMLElement): void {
  if (card.querySelector(".pos-product-mobile-add-indicator")) return;

  const plus = document.createElement("span");
  plus.className = "pos-product-mobile-add-indicator";
  plus.setAttribute("aria-hidden", "true");
  plus.textContent = "+";
  card.appendChild(plus);
}

function ubuzimaRenderCanonicalCard(card: HTMLElement): void {
  if (!ubuzimaLooksLikeProductCard(card)) return;

  const name = ubuzimaProductName(card);
  const price = ubuzimaFieldValue(card, "price");
  const stock = ubuzimaFieldValue(card, "stock");
  const expiry = ubuzimaFieldValue(card, "expiry");
  const days = ubuzimaFieldValue(card, "days");
  const state = ubuzimaExpiryState(card);

  card.setAttribute("data-ubuzima-pos-card-canonical", "true");
  card.setAttribute("data-ubuzima-pos-card-flow", "ordered-left");
  card.setAttribute("data-ubuzima-expiry-state", state);

  card.classList.remove(
    "ubuzima-pos-expiry-expired",
    "ubuzima-pos-expiry-critical",
    "ubuzima-pos-expiry-warning",
    "ubuzima-pos-expiry-safe",
    "ubuzima-pos-expiry-unknown",
  );
  card.classList.add(`ubuzima-pos-expiry-${state}`);

  let panel = card.querySelector<HTMLElement>(".ubuzima-pos-card-canonical");

  if (!panel) {
    panel = document.createElement("div");
    panel.className = "ubuzima-pos-card-canonical";
    card.prepend(panel);
  }

  panel.innerHTML = `
    <div class="ubuzima-pos-card-canonical-row ubuzima-pos-card-canonical-row--name">
      <span>Product Name</span>
      <strong>${ubuzimaEscapeHtml(name)}</strong>
    </div>
    <div class="ubuzima-pos-card-canonical-row ubuzima-pos-card-canonical-row--price">
      <span>Price</span>
      <strong>${ubuzimaEscapeHtml(price)}</strong>
    </div>
    <div class="ubuzima-pos-card-canonical-row ubuzima-pos-card-canonical-row--stock">
      <span>${ubuzimaIsMobilePwa() ? "Available Quantity" : "Stock Quantity"}</span>
      <strong>${ubuzimaEscapeHtml(stock)}</strong>
    </div>
    <div class="ubuzima-pos-card-canonical-row ubuzima-pos-card-canonical-row--expiry">
      <span>Expiry Date</span>
      <strong>${ubuzimaEscapeHtml(expiry)}</strong>
    </div>
    <div class="ubuzima-pos-card-canonical-row ubuzima-pos-card-canonical-row--days">
      <span>Remaining Days</span>
      <strong>${ubuzimaEscapeHtml(days)}</strong>
    </div>
  `;

  ubuzimaEnsurePlus(card);

  Array.from(card.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (child === panel) return;
    if (child.classList.contains("pos-product-mobile-add-indicator")) return;
    child.setAttribute("data-ubuzima-pos-card-source", "hidden");
  });
}

function ubuzimaApplyCanonicalCards(): void {
  if (!ubuzimaIsPosSurface()) return;

  Array.from(document.querySelectorAll<HTMLElement>(UBUZIMA_POS_CARD_SELECTOR)).forEach(ubuzimaRenderCanonicalCard);

  document.documentElement.classList.toggle("ubuzima-pos-mobile-card-mode", ubuzimaIsMobilePwa());
  document.documentElement.classList.toggle("ubuzima-pos-web-card-mode", !ubuzimaIsMobilePwa());
}

function bootUbuzimaCanonicalCards(): void {
  ubuzimaApplyCanonicalCards();

  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(ubuzimaApplyCanonicalCards, 120);
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
    document.addEventListener("DOMContentLoaded", bootUbuzimaCanonicalCards);
  } else {
    bootUbuzimaCanonicalCards();
  }
}

export {};

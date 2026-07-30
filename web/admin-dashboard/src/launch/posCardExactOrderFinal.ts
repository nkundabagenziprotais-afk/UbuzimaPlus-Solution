type ExpiryState = "expired" | "critical" | "warning" | "safe" | "unknown";

const CARD_SELECTOR = [
  ".pos-product-card",
  ".pos-product-tile",
  ".pos-product-tile-v16",
  ".pos-product-grid button",
  ".pos-drug-list button",
].join(",");

function cleanText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function lower(node: Element | null | undefined): string {
  return cleanText(node).toLowerCase();
}

function isMobilePwa(): boolean {
  return document.documentElement.classList.contains("ubuzima-mobile-pwa-active");
}

function isPosSurface(): boolean {
  return Boolean(
    document.querySelector(".pos-counter-page") ||
      document.querySelector(".pos-product-stock-section") ||
      document.querySelector(".pos-product-grid") ||
      document.querySelector(".pos-drug-list") ||
      document.querySelector(".pos-drug-list--ten") ||
      document.querySelector(".retail-pos-grid"),
  );
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function originalText(card: HTMLElement): string {
  const clone = card.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll(".ubuzima-pos-card-canonical, .ubuzima-pos-card-final, .pos-product-mobile-add-indicator")
    .forEach((node) => node.remove());

  return cleanText(clone);
}

function fieldCandidates(card: HTMLElement): HTMLElement[] {
  return Array.from(
    card.querySelectorAll<HTMLElement>(
      ".pos-product-card-info-row, .pos-product-card-metric, .pos-product-card-line, .pos-product-card-row, [class*='info'], [class*='metric'], [class*='price'], [class*='stock'], [class*='available'], [class*='expiry'], [class*='days']",
    ),
  ).filter((node) => !node.closest(".ubuzima-pos-card-canonical, .ubuzima-pos-card-final"));
}

function findCandidate(card: HTMLElement, terms: string[]): string {
  const nodes = fieldCandidates(card);

  const match = nodes.find((node) => {
    const haystack = `${lower(node)} ${String(node.className || "").toLowerCase()}`;
    return terms.some((term) => haystack.includes(term));
  });

  return cleanText(match);
}

function cleanValue(value: string, type: "price" | "stock" | "expiry" | "days"): string {
  let text = value.replace(/\s+/g, " ").trim();

  if (type === "price") {
    return (
      text.match(/(?:RWF|FRW)\s*[\d.,]+/i)?.[0] ||
      text.match(/[\d.,]+\s*(?:RWF|FRW)/i)?.[0] ||
      text.match(/[\d.,]+/)?.[0] ||
      text.replace(/price|unit price|selling price|amount|rate|cost/gi, "").trim()
    );
  }

  if (type === "stock") {
    return (
      text.match(/(?:stock|available|qty|quantity)[^\d-]*(-?[\d.,]+)/i)?.[1] ||
      text.match(/-?[\d.,]+/)?.[0] ||
      text.replace(/stock quantity|available quantity|available|stock|qty|quantity/gi, "").trim()
    );
  }

  if (type === "expiry") {
    return (
      text.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/)?.[0] ||
      text.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)?.[0] ||
      text.replace(/expiry date|expiry|expire|expiration|exp\.?/gi, "").trim()
    );
  }

  return (
    text.match(/-?\d+\s*(?:remaining\s*)?days?/i)?.[0] ||
    text.match(/remaining\s*days?[^\d-]*-?\d+/i)?.[0] ||
    text.match(/days?\s*left[^\d-]*-?\d+/i)?.[0] ||
    text.replace(/remaining days|remaining|days left|days/gi, "").trim()
  );
}

function fallbackValue(card: HTMLElement, type: "price" | "stock" | "expiry" | "days"): string {
  const text = originalText(card);

  if (type === "price") {
    return (
      text.match(/(?:RWF|FRW)\s*[\d.,]+/i)?.[0] ||
      text.match(/[\d.,]+\s*(?:RWF|FRW)/i)?.[0] ||
      ""
    );
  }

  if (type === "stock") {
    return text.match(/(?:stock|available|qty|quantity)[^\d-]*(-?[\d.,]+)/i)?.[1] || "";
  }

  if (type === "expiry") {
    return (
      text.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/)?.[0] ||
      text.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)?.[0] ||
      ""
    );
  }

  return (
    text.match(/-?\d+\s*(?:remaining\s*)?days?/i)?.[0] ||
    text.match(/remaining\s*days?[^\d-]*-?\d+/i)?.[0] ||
    ""
  );
}

function valueFor(card: HTMLElement, type: "price" | "stock" | "expiry" | "days"): string {
  const terms = {
    price: ["price", "unit price", "selling price", "amount", "rate", "rwf", "frw"],
    stock: ["stock", "stock quantity", "available", "available quantity", "qty", "quantity"],
    expiry: ["expiry", "expire", "expiration", "exp"],
    days: ["remaining", "days", "days left"],
  }[type];

  return cleanValue(findCandidate(card, terms), type) || fallbackValue(card, type) || "—";
}

function productName(card: HTMLElement): string {
  const explicit =
    card.querySelector<HTMLElement>(".pos-product-card-name") ||
    card.querySelector<HTMLElement>("h3") ||
    Array.from(card.querySelectorAll<HTMLElement>("strong")).find((node) => {
      return !/\b(price|stock|qty|quantity|expiry|days|rwf|frw|available)\b/i.test(cleanText(node));
    });

  const name = cleanText(explicit);
  if (name && name.length > 1) return name;

  const text = originalText(card);
  return (
    text.split(/\b(price|stock|available|qty|quantity|expiry|expire|remaining|days|rwf|frw)\b/i)[0].trim() ||
    "Product"
  );
}

function daysNumber(card: HTMLElement): number | null {
  const days = Number(valueFor(card, "days").match(/-?\d+/)?.[0]);
  if (Number.isFinite(days)) return days;

  const expiry = valueFor(card, "expiry");
  const dmy = expiry.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  const ymd = expiry.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  const match = dmy || ymd;
  if (!match) return null;

  const year = ymd ? Number(match[1]) : Number(match[3]);
  const month = ymd ? Number(match[2]) : Number(match[2]);
  const day = ymd ? Number(match[3]) : Number(match[1]);

  const expiryDate = new Date(year, month - 1, day);
  if (!Number.isFinite(expiryDate.getTime())) return null;

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startExpiry = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());

  return Math.ceil((startExpiry.getTime() - startToday.getTime()) / 86400000);
}

function expiryState(card: HTMLElement): ExpiryState {
  const days = daysNumber(card);

  if (days === null) return "unknown";
  if (days <= 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "safe";
}

function ensurePlus(card: HTMLElement): void {
  if (card.querySelector(".pos-product-mobile-add-indicator")) return;

  const plus = document.createElement("span");
  plus.className = "pos-product-mobile-add-indicator";
  plus.setAttribute("aria-hidden", "true");
  plus.textContent = "+";
  card.appendChild(plus);
}

function renderCard(card: HTMLElement): void {
  if (!/\b(price|stock|available|quantity|expiry|expire|remaining|days|rwf|frw)\b/i.test(originalText(card))) return;

  const state = expiryState(card);

  card.setAttribute("data-ubuzima-pos-card-final", "true");
  card.setAttribute("data-ubuzima-pos-card-flow", "exact-left");
  card.setAttribute("data-ubuzima-expiry-state", state);

  card.classList.remove(
    "ubuzima-pos-expiry-expired",
    "ubuzima-pos-expiry-critical",
    "ubuzima-pos-expiry-warning",
    "ubuzima-pos-expiry-safe",
    "ubuzima-pos-expiry-unknown",
  );
  card.classList.add(`ubuzima-pos-expiry-${state}`);

  let panel = card.querySelector<HTMLElement>(".ubuzima-pos-card-final");

  if (!panel) {
    panel = document.createElement("div");
    panel.className = "ubuzima-pos-card-final";
    card.prepend(panel);
  }

  panel.innerHTML = `
    <span class="ubuzima-pos-card-final-strip" aria-hidden="true"></span>
    <div class="ubuzima-pos-card-final-row ubuzima-pos-card-final-row--name">
      <span>Product Name</span>
      <strong>${htmlEscape(productName(card))}</strong>
    </div>
    <div class="ubuzima-pos-card-final-row ubuzima-pos-card-final-row--price">
      <span>Price</span>
      <strong>${htmlEscape(valueFor(card, "price"))}</strong>
    </div>
    <div class="ubuzima-pos-card-final-row ubuzima-pos-card-final-row--stock">
      <span>${isMobilePwa() ? "Available Quantity" : "Stock Quantity"}</span>
      <strong>${htmlEscape(valueFor(card, "stock"))}</strong>
    </div>
    <div class="ubuzima-pos-card-final-row ubuzima-pos-card-final-row--expiry">
      <span>Expiry Date</span>
      <strong>${htmlEscape(valueFor(card, "expiry"))}</strong>
    </div>
    <div class="ubuzima-pos-card-final-row ubuzima-pos-card-final-row--days">
      <span>Remaining Days</span>
      <strong>${htmlEscape(valueFor(card, "days"))}</strong>
    </div>
  `;

  Array.from(card.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (child === panel) return;
    if (child.classList.contains("pos-product-mobile-add-indicator")) return;
    child.setAttribute("data-ubuzima-pos-card-original-hidden", "true");
  });

  ensurePlus(card);
}

function applyCards(): void {
  if (!isPosSurface()) return;

  Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR)).forEach(renderCard);
}

function boot(): void {
  applyCards();

  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyCards, 100);
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

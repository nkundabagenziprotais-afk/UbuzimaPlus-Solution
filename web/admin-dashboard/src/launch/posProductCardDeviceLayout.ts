/**
 * POS product card device layout.
 * Enforces ordered, left-aligned information flow.
 */

type ExpiryState = "expired" | "critical" | "warning" | "safe" | "unknown";

const CARD_SELECTOR = [
  ".pos-product-card",
  ".pos-product-tile",
  ".pos-product-tile-v16",
  ".pos-product-grid button",
  ".pos-drug-list button",
].join(",");

const FIELD_SELECTORS = [
  ".pos-product-card-info-row",
  ".pos-product-card-metric",
  ".pos-product-card-line",
  ".pos-product-card-row",
  "[class*='info-row']",
  "[class*='metric']",
  "[class*='price']",
  "[class*='stock']",
  "[class*='available']",
  "[class*='expiry']",
  "[class*='days']",
].join(",");

function textOf(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function lowerText(node: Element | null | undefined): string {
  return textOf(node).toLowerCase();
}

function isInstalledMobilePwa(): boolean {
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

function looksLikeProductCard(card: HTMLElement): boolean {
  const text = lowerText(card);
  if (!text || text.length < 3) return false;

  return Boolean(
    card.matches(".pos-product-card, .pos-product-tile, .pos-product-tile-v16") ||
      card.closest(".pos-product-grid, .pos-drug-list, .pos-drug-list--ten") ||
      text.includes("price") ||
      text.includes("stock") ||
      text.includes("available") ||
      text.includes("expiry"),
  );
}

function classifyField(field: HTMLElement): string | null {
  const text = lowerText(field);

  if (/\b(price|unit price|selling price|amount|rate|rwf|frw)\b/i.test(text)) return "price";
  if (/\b(stock|stock qty|stock quantity|available|available quantity|qty available|quantity)\b/i.test(text)) return "stock";
  if (/\b(expiry|expire|expiration|exp\.?)\b/i.test(text)) return "expiry";
  if (/\b(remaining|days?|days left|remaining days)\b/i.test(text)) return "days";

  return null;
}

function nameElement(card: HTMLElement): HTMLElement | null {
  return (
    card.querySelector<HTMLElement>(".pos-product-card-name") ||
    card.querySelector<HTMLElement>("h3") ||
    Array.from(card.querySelectorAll<HTMLElement>("strong")).find((node) => {
      const text = lowerText(node);
      return !/\b(price|stock|qty|expiry|days|rwf|frw)\b/i.test(text);
    }) ||
    card.querySelector<HTMLElement>("strong")
  );
}

function parseDaysFromText(text: string): number | null {
  const normalized = text.toLowerCase();
  const match =
    normalized.match(/(-?\d+)\s*(remaining\s*)?days?/) ||
    normalized.match(/remaining\s*days?\D*(-?\d+)/) ||
    normalized.match(/days?\s*left\D*(-?\d+)/);

  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseExpiryDateFromText(text: string): Date | null {
  const patterns = [
    /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/,
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

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

    if (!year || !month || !day) continue;

    const date = new Date(year, month - 1, day);
    if (Number.isFinite(date.getTime())) return date;
  }

  return null;
}

function daysUntil(date: Date): number {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startExpiry = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return Math.ceil((startExpiry.getTime() - startToday.getTime()) / 86400000);
}

function expiryStateFor(card: HTMLElement): ExpiryState {
  const text = textOf(card);
  const parsedDays = parseDaysFromText(text);

  const days =
    parsedDays !== null
      ? parsedDays
      : (() => {
          const date = parseExpiryDateFromText(text);
          return date ? daysUntil(date) : null;
        })();

  if (days === null) return "unknown";
  if (days <= 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "safe";
}

function applyExpiryState(card: HTMLElement): void {
  card.classList.remove(
    "ubuzima-pos-expiry-expired",
    "ubuzima-pos-expiry-critical",
    "ubuzima-pos-expiry-warning",
    "ubuzima-pos-expiry-safe",
    "ubuzima-pos-expiry-unknown",
  );

  card.classList.add(`ubuzima-pos-expiry-${expiryStateFor(card)}`);
}

function ensureMobileAddIndicator(card: HTMLElement): void {
  if (card.querySelector(".pos-product-mobile-add-indicator")) return;

  const indicator = document.createElement("span");
  indicator.className = "pos-product-mobile-add-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.textContent = "+";

  card.appendChild(indicator);
}

function decorateCard(card: HTMLElement): void {
  if (!looksLikeProductCard(card)) return;

  card.setAttribute("data-ubuzima-pos-device-card", "true");
  card.setAttribute("data-ubuzima-pos-card-flow", "ordered-left");
  card.classList.toggle("ubuzima-pos-product-card--mobile-app", isInstalledMobilePwa());
  card.classList.toggle("ubuzima-pos-product-card--web", !isInstalledMobilePwa());

  const name = nameElement(card);
  if (name) {
    name.classList.add("ubuzima-pos-card-row", "ubuzima-pos-card-row--name");
  }

  Array.from(card.querySelectorAll<HTMLElement>(FIELD_SELECTORS)).forEach((field) => {
    const type = classifyField(field);
    if (!type) return;

    field.classList.add("ubuzima-pos-card-row", `ubuzima-pos-card-row--${type}`);

    if (type === "stock") {
      field.classList.add("ubuzima-pos-card-row--available");
    }
  });

  applyExpiryState(card);
  ensureMobileAddIndicator(card);
}

function decorateProductCards(): void {
  if (!isPosSurface()) return;

  Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR)).forEach(decorateCard);

  document.documentElement.classList.toggle("ubuzima-pos-mobile-card-mode", isInstalledMobilePwa());
  document.documentElement.classList.toggle("ubuzima-pos-web-card-mode", !isInstalledMobilePwa());
}

function bootPosProductCardDeviceLayout(): void {
  decorateProductCards();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(decorateProductCards, 120);
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
    document.addEventListener("DOMContentLoaded", bootPosProductCardDeviceLayout);
  } else {
    bootPosProductCardDeviceLayout();
  }
}

export {};

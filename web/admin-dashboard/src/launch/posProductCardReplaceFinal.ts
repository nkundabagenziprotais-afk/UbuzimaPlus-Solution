function clean(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function valueFrom(tile: HTMLElement, selectors: string[]): string {
  for (const selector of selectors) {
    const node = tile.querySelector(selector);
    const value = clean(node?.textContent);
    if (value && value !== "—") return value;
  }

  return "—";
}

function expiryFromTile(tile: HTMLElement): string {
  const fromExisting = valueFrom(tile, [
    ".ubuzima-pos-v4-row--expiry .ubuzima-pos-v4-value",
    ".ubuzima-pos-v3-row--expiry strong",
    ".ubuzima-real-pos-card__row--expiry strong",
    ".ubuzima-pos-photo-row--expiry .ubuzima-pos-photo-value",
  ]);

  if (fromExisting !== "—") return fromExisting;

  const title = tile.getAttribute("title") || "";
  return clean(title.match(/Expiry:\s*([^/]+)/i)?.[1]) || "—";
}

function daysFromTile(tile: HTMLElement): string {
  const fromExisting = valueFrom(tile, [
    ".ubuzima-pos-v4-row--days .ubuzima-pos-v4-value",
    ".ubuzima-pos-v3-row--days strong",
    ".ubuzima-real-pos-card__row--days strong",
    ".ubuzima-pos-photo-row--days .ubuzima-pos-photo-value",
  ]);

  if (fromExisting !== "—") return fromExisting;

  const title = tile.getAttribute("title") || "";
  const days = title.match(/\/\s*(-?\d+)\s*d/i)?.[1];

  return days ? `${days} days` : "—";
}

function expiryState(tile: HTMLElement): string {
  if (tile.classList.contains("product-expiry-expired")) return "expired";
  if (tile.classList.contains("product-expiry-critical")) return "critical";
  if (tile.classList.contains("product-expiry-warning")) return "warning";
  if (tile.classList.contains("product-expiry-watch")) return "watch";
  if (tile.classList.contains("product-expiry-safe")) return "safe";

  const title = tile.getAttribute("title") || "";
  const daysMatch = title.match(/\/\s*(-?\d+)\s*d/i) || title.match(/(-?\d+)\s*(?:day|days)/i);
  const days = daysMatch ? Number(daysMatch[1]) : Number.NaN;

  if (!Number.isFinite(days)) return "safe";
  if (days <= 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  if (days <= 180) return "watch";
  return "safe";
}

function row(kind: string, value: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = `ubuzima-pos-replaced-card__row ubuzima-pos-replaced-card__row--${kind}`;

  const valueNode = document.createElement("strong");
  valueNode.className = "ubuzima-pos-replaced-card__value";
  valueNode.textContent = value || "—";

  wrapper.appendChild(valueNode);
  return wrapper;
}

function replaceCard(tile: HTMLElement): void {
  if (!tile.matches(".pos-product-tile-v16")) return;
  if (tile.getAttribute("data-ubuzima-pos-card-replaced-final") === "true") return;

  const product = valueFrom(tile, [
    ".pos-product-card-name",
    ".ubuzima-pos-v4-row--name .ubuzima-pos-v4-value",
    ".ubuzima-pos-v3-row--name strong",
    ".ubuzima-real-pos-card__row--name strong",
    ".ubuzima-pos-photo-row--product .ubuzima-pos-photo-value",
  ]);

  const amount = valueFrom(tile, [
    ".pos-product-card-price em",
    ".ubuzima-pos-v4-row--price .ubuzima-pos-v4-value",
    ".ubuzima-pos-v3-row--price strong",
    ".ubuzima-real-pos-card__row--price strong",
    ".ubuzima-pos-photo-row--amount .ubuzima-pos-photo-value",
  ]);

  const quantity = valueFrom(tile, [
    ".pos-product-card-stock strong",
    ".ubuzima-pos-v4-row--stock .ubuzima-pos-v4-value",
    ".ubuzima-pos-v3-row--stock strong",
    ".ubuzima-real-pos-card__row--stock strong",
    ".ubuzima-pos-photo-row--qty .ubuzima-pos-photo-value",
  ]);

  const expiry = expiryFromTile(tile);
  const days = daysFromTile(tile);

  if (!product || product === "—" || !amount || amount === "—" || !quantity || quantity === "—") return;

  const card = document.createElement("div");
  card.className = "ubuzima-pos-replaced-card";

  card.append(
    row("product", product),
    row("amount", amount),
    row("quantity", quantity),
    row("expiry", expiry),
    row("days", days),
  );

  tile.replaceChildren(card);
  tile.setAttribute("data-ubuzima-pos-card-replaced-final", "true");
  tile.setAttribute("data-ubuzima-expiry-state", expiryState(tile));
}

function applyCards(): void {
  document
    .querySelectorAll<HTMLElement>(".pos-drug-list--ten > .pos-product-tile-v16, .pos-product-tile-v16")
    .forEach((tile) => {
      if (tile.querySelector(".ubuzima-pos-replaced-card")) return;
      tile.removeAttribute("data-ubuzima-pos-card-replaced-final");
      replaceCard(tile);
    });
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
    attributeFilter: ["class", "title"],
  });

  window.addEventListener("pageshow", schedule);
  window.addEventListener("resize", schedule);
  window.setInterval(applyCards, 1500);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}

export {};

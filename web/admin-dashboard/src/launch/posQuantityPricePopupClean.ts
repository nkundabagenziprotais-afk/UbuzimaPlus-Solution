function txt(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function ctx(input: HTMLInputElement): string {
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute("aria-label"),
    input.closest("label")?.textContent,
    input.parentElement?.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function qty(input: HTMLInputElement): boolean {
  return /\b(qty|quantity|units?|pack|packs?)\b/i.test(ctx(input));
}

function price(input: HTMLInputElement): boolean {
  return /\b(price|unit price|selling price|amount|rate|cost)\b/i.test(ctx(input));
}

function field(input: HTMLInputElement): HTMLElement {
  return (
    input.closest<HTMLElement>("label") ||
    input.closest<HTMLElement>(".pos-quantity-selling-unit-hero, .pos-quantity-price-override-card, .form-group, .field, [class*='field'], [class*='form'], article, section, div") ||
    input.parentElement ||
    input
  );
}

function isPopup(node: HTMLElement): boolean {
  const text = txt(node).toLowerCase();
  return Boolean(node.querySelector("input") && /\b(qty|quantity)\b/i.test(text) && /\b(price|amount|rate|cost)\b/i.test(text));
}

function decoratePopup(dialog: HTMLElement): void {
  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>("input"));
  if (inputs.length < 2) return;

  const numeric = inputs.filter((input) => input.type === "number" || input.inputMode === "numeric" || /\d/.test(input.value || ""));
  const quantityInput = inputs.find(qty) || numeric[0] || inputs[0];
  const priceInput = inputs.find((input) => input !== quantityInput && price(input)) || numeric.find((input) => input !== quantityInput) || inputs.find((input) => input !== quantityInput);

  if (!quantityInput || !priceInput || quantityInput === priceInput) return;

  dialog.classList.add("ubuzima-pos-popup-clean");

  const quantityField = field(quantityInput);
  const priceField = field(priceInput);

  quantityField.classList.add("ubuzima-pos-popup-clean-edit", "ubuzima-pos-popup-clean-edit--quantity");
  priceField.classList.add("ubuzima-pos-popup-clean-edit", "ubuzima-pos-popup-clean-edit--price");

  quantityInput.classList.add("ubuzima-pos-popup-clean-input");
  priceInput.classList.add("ubuzima-pos-popup-clean-input");

  dialog.querySelectorAll<HTMLElement>(".pos-quantity-readonly-grid article, article, section").forEach((node) => {
    if (node.closest(".ubuzima-pos-popup-clean-edit")) return;

    const value = txt(node);
    const useful = /\b(total|stock|available|expiry|price|quantity|qty|unit|product|batch|rwf|frw|\d)\b/i.test(value);

    node.classList.toggle("ubuzima-pos-popup-clean-info", useful);
    node.classList.toggle("ubuzima-pos-popup-clean-hide", !useful && value.length > 30);
  });

  dialog.querySelectorAll<HTMLElement>("p, small, [class*='hint'], [class*='helper'], [class*='description'], [class*='note']").forEach((node) => {
    const value = txt(node);
    const useful = /\b(total|stock|available|expiry|price|quantity|qty|unit|product|batch|rwf|frw|\d)\b/i.test(value);

    if (!useful && value.length > 30) node.classList.add("ubuzima-pos-popup-clean-hide");
  });
}

function applyPopups(): void {
  Array.from(
    document.querySelectorAll<HTMLElement>(
      ".pos-quantity-dialog, [role='dialog'], [role='alertdialog'], dialog, .modal, [class*='modal'], [class*='dialog'], [class*='popover'], [class*='sheet']",
    ),
  )
    .filter(isPopup)
    .forEach(decoratePopup);
}

function boot(): void {
  applyPopups();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyPopups, 120);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "role"],
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}

export {};

function cleanText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function inputContext(input: HTMLInputElement): string {
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

function isQuantity(input: HTMLInputElement): boolean {
  return /\b(qty|quantity|units?|pack|packs?)\b/i.test(inputContext(input));
}

function isPrice(input: HTMLInputElement): boolean {
  return /\b(price|unit price|selling price|amount|rate|cost)\b/i.test(inputContext(input));
}

function fieldOf(input: HTMLInputElement): HTMLElement {
  return (
    input.closest<HTMLElement>("label") ||
    input.closest<HTMLElement>(".pos-quantity-selling-unit-hero, .pos-quantity-price-override-card, .form-group, .field, [class*='field'], [class*='form'], article, section, div") ||
    input.parentElement ||
    input
  );
}

function isQuantityDialog(node: HTMLElement): boolean {
  const value = cleanText(node).toLowerCase();

  return Boolean(node.matches(".pos-quantity-dialog") || (node.querySelector("input") && /\b(qty|quantity)\b/i.test(value) && /\b(price|amount|rate|cost)\b/i.test(value)));
}

function decorateDialog(dialog: HTMLElement): void {
  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>("input"));
  if (inputs.length < 2) return;

  const numeric = inputs.filter((input) => input.type === "number" || input.inputMode === "numeric" || /\d/.test(input.value || ""));
  const quantityInput = inputs.find(isQuantity) || numeric[0] || inputs[0];
  const priceInput = inputs.find((input) => input !== quantityInput && isPrice(input)) || numeric.find((input) => input !== quantityInput) || inputs.find((input) => input !== quantityInput);

  if (!quantityInput || !priceInput || quantityInput === priceInput) return;

  dialog.classList.add("ubuzima-real-pos-dialog");

  const quantityField = fieldOf(quantityInput);
  const priceField = fieldOf(priceInput);

  quantityField.classList.add("ubuzima-real-pos-dialog__edit", "ubuzima-real-pos-dialog__edit--quantity");
  priceField.classList.add("ubuzima-real-pos-dialog__edit", "ubuzima-real-pos-dialog__edit--price");

  quantityInput.classList.add("ubuzima-real-pos-dialog__input");
  priceInput.classList.add("ubuzima-real-pos-dialog__input");

  dialog.querySelectorAll<HTMLElement>(".pos-quantity-readonly-grid article, article, section").forEach((node) => {
    if (node.closest(".ubuzima-real-pos-dialog__edit")) return;

    const value = cleanText(node);
    const useful = /\b(total|stock|available|expiry|price|quantity|qty|unit|product|batch|rwf|frw|\d)\b/i.test(value);

    node.classList.toggle("ubuzima-real-pos-dialog__info", useful);
    node.classList.toggle("ubuzima-real-pos-dialog__noise", !useful && value.length > 30);
  });
}

function applyDialogs(): void {
  document
    .querySelectorAll<HTMLElement>(".pos-quantity-dialog, [role='dialog'], [role='alertdialog'], dialog, .modal, [class*='dialog']")
    .forEach((node) => {
      if (isQuantityDialog(node)) decorateDialog(node);
    });
}

function boot(): void {
  applyDialogs();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyDialogs, 120);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "role"],
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}

export {};

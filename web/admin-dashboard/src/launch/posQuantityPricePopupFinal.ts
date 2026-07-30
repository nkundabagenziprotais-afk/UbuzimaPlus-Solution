function popupText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim().toLowerCase();
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
    .trim()
    .toLowerCase();
}

function isQuantity(input: HTMLInputElement): boolean {
  return /\b(qty|quantity|units?|pack|packs?)\b/i.test(inputContext(input));
}

function isPrice(input: HTMLInputElement): boolean {
  return /\b(price|unit price|selling price|amount|rate|cost)\b/i.test(inputContext(input));
}

function field(input: HTMLInputElement): HTMLElement {
  return (
    input.closest<HTMLElement>("label") ||
    input.closest<HTMLElement>(".pos-quantity-selling-unit-hero, .pos-quantity-price-override-card, .form-group, .field, [class*='field'], [class*='form'], article, section, div") ||
    input.parentElement ||
    input
  );
}

function dialogCandidate(node: HTMLElement): boolean {
  if (node.classList.contains("pos-quantity-dialog")) return true;

  const text = popupText(node);
  return Boolean(node.querySelector("input") && /\b(qty|quantity)\b/i.test(text) && /\b(price|amount|rate|cost)\b/i.test(text));
}

function markBackdrop(dialog: HTMLElement): void {
  let parent = dialog.parentElement;

  for (let i = 0; parent && i < 5; i += 1) {
    if (parent === document.body || parent === document.documentElement) break;
    parent.classList.add("ubuzima-pos-popup-final-backdrop");
    return;
  }
}

function applyPopup(dialog: HTMLElement): void {
  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>("input"));
  const numericInputs = inputs.filter((input) => input.type === "number" || input.inputMode === "numeric" || /\d/.test(input.value || ""));

  const quantityInput = inputs.find(isQuantity) || numericInputs[0] || inputs[0];
  const priceInput = inputs.find(isPrice) || numericInputs.find((input) => input !== quantityInput) || inputs[1];

  if (!quantityInput || !priceInput || quantityInput === priceInput) return;

  dialog.classList.add("ubuzima-pos-popup-final");
  dialog.setAttribute("data-ubuzima-pos-popup-final", "true");
  markBackdrop(dialog);

  const quantityField = field(quantityInput);
  const priceField = field(priceInput);

  quantityField.classList.add("ubuzima-pos-popup-final-card", "ubuzima-pos-popup-final-card--quantity");
  priceField.classList.add("ubuzima-pos-popup-final-card", "ubuzima-pos-popup-final-card--price");

  quantityInput.classList.add("ubuzima-pos-popup-final-input", "ubuzima-pos-popup-final-input--quantity");
  priceInput.classList.add("ubuzima-pos-popup-final-input", "ubuzima-pos-popup-final-input--price");

  dialog
    .querySelectorAll<HTMLElement>(".pos-quantity-readonly-grid article, .pos-quantity-total-strip, article, section")
    .forEach((node) => {
      if (node.closest(".ubuzima-pos-popup-final-card")) return;
      node.classList.add("ubuzima-pos-popup-final-info-card");
    });
}

function applyAll(): void {
  Array.from(
    document.querySelectorAll<HTMLElement>(
      ".pos-quantity-dialog, [role='dialog'], [role='alertdialog'], dialog, .modal, [class*='modal'], [class*='dialog'], [class*='popover'], [class*='sheet']",
    ),
  )
    .filter(dialogCandidate)
    .forEach(applyPopup);
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

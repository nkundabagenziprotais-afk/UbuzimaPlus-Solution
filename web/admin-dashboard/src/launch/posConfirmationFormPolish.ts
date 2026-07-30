/**
 * POS quantity/price confirmation polish.
 * Centers the modal and forces Quantity + Price into one professional row.
 */

function posConfirmText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function inputText(input: HTMLInputElement): string {
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

function isPosOpen(): boolean {
  return Boolean(
    document.querySelector(".pos-counter-page") ||
      document.querySelector(".pos-product-stock-section") ||
      document.querySelector(".pos-drug-list") ||
      document.querySelector(".pos-drug-list--ten") ||
      document.querySelector(".retail-pos-grid") ||
      document.documentElement.classList.contains("ubuzima-pos-web-restored"),
  );
}

function isQuantityInput(input: HTMLInputElement): boolean {
  return /\b(qty|quantity|units?|pack|packs?)\b/i.test(inputText(input));
}

function isPriceInput(input: HTMLInputElement): boolean {
  return /\b(price|unit price|selling price|amount|rate|cost)\b/i.test(inputText(input));
}

function fieldFor(input: HTMLInputElement): HTMLElement {
  return (
    input.closest<HTMLElement>("label") ||
    input.closest<HTMLElement>(".form-group, .field, [class*='field'], [class*='form'], article, section, div") ||
    input.parentElement ||
    input
  );
}

function immediateChildUnder(parent: HTMLElement, child: HTMLElement): HTMLElement {
  let current: HTMLElement = child;

  while (current.parentElement && current.parentElement !== parent) {
    current = current.parentElement;
  }

  return current;
}

function commonAncestor(a: HTMLElement, b: HTMLElement, stop: HTMLElement): HTMLElement {
  const parents = new Set<HTMLElement>();
  let current: HTMLElement | null = a;

  while (current && current !== stop.parentElement) {
    parents.add(current);
    current = current.parentElement;
  }

  current = b;

  while (current && current !== stop.parentElement) {
    if (parents.has(current)) return current;
    current = current.parentElement;
  }

  return stop;
}

function isDialogCandidate(node: HTMLElement): boolean {
  if (node.classList.contains("pos-quantity-dialog")) return true;

  const text = posConfirmText(node);
  if (!text) return false;

  const hasQuantity = /\b(qty|quantity|units?|pack|packs?)\b/i.test(text);
  const hasPrice = /\b(price|unit price|selling price|amount|rate|cost)\b/i.test(text);

  return Boolean(node.querySelector("input")) && hasQuantity && hasPrice;
}

function markBackdrop(dialog: HTMLElement): void {
  const directBackdrop =
    dialog.closest<HTMLElement>(
      ".pos-quantity-dialog-backdrop, [class*='backdrop'], [class*='overlay'], [class*='portal'], [class*='modal-root'], [class*='modalRoot']",
    ) || null;

  if (
    directBackdrop &&
    directBackdrop !== dialog &&
    directBackdrop !== document.body &&
    directBackdrop !== document.documentElement
  ) {
    directBackdrop.classList.add("ubuzima-pos-confirmation-backdrop");
    return;
  }

  let parent = dialog.parentElement;

  for (let depth = 0; parent && depth < 4; depth += 1) {
    if (parent === document.body || parent === document.documentElement) break;

    parent.classList.add("ubuzima-pos-confirmation-backdrop");
    return;
  }
}

function polishDialog(dialog: HTMLElement): void {
  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>("input"));

  const quantityInput = inputs.find(isQuantityInput);
  const priceInput = inputs.find(isPriceInput);

  if (!quantityInput || !priceInput) return;

  dialog.classList.add("ubuzima-pos-confirmation-dialog");
  dialog.setAttribute("data-ubuzima-pos-confirmation-polished", "true");

  markBackdrop(dialog);

  const quantityField = fieldFor(quantityInput);
  const priceField = fieldFor(priceInput);

  quantityField.classList.add(
    "ubuzima-pos-confirmation-field",
    "ubuzima-pos-confirmation-field--quantity",
  );

  priceField.classList.add(
    "ubuzima-pos-confirmation-field",
    "ubuzima-pos-confirmation-field--price",
  );

  quantityInput.classList.add(
    "ubuzima-pos-confirmation-input",
    "ubuzima-pos-confirmation-input--quantity",
  );

  priceInput.classList.add(
    "ubuzima-pos-confirmation-input",
    "ubuzima-pos-confirmation-input--price",
  );

  let grid = commonAncestor(quantityField, priceField, dialog);

  if (grid === dialog || grid.querySelectorAll("input, select, textarea").length > 5) {
    grid =
      quantityField.parentElement && quantityField.parentElement.contains(priceField)
        ? quantityField.parentElement
        : priceField.parentElement && priceField.parentElement.contains(quantityField)
          ? priceField.parentElement
          : grid;
  }

  if (grid && grid !== document.body && grid !== document.documentElement) {
    grid.classList.add("ubuzima-pos-confirmation-grid");

    const quantityGridChild = immediateChildUnder(grid, quantityField);
    const priceGridChild = immediateChildUnder(grid, priceField);

    quantityGridChild.classList.add(
      "ubuzima-pos-confirmation-grid-item",
      "ubuzima-pos-confirmation-grid-item--quantity",
    );

    priceGridChild.classList.add(
      "ubuzima-pos-confirmation-grid-item",
      "ubuzima-pos-confirmation-grid-item--price",
    );

    Array.from(grid.children).forEach((child) => {
      if (
        child !== quantityGridChild &&
        child !== priceGridChild &&
        child instanceof HTMLElement
      ) {
        child.classList.add("ubuzima-pos-confirmation-grid-item--full");
      }
    });
  }
}

function polishDialogs(): void {
  if (!isPosOpen()) return;

  Array.from(
    document.querySelectorAll<HTMLElement>(
      ".pos-quantity-dialog, [data-ubuzima-pos-confirmation-polished='true'], [role='dialog'], [role='alertdialog'], dialog, .modal, [class*='modal'], [class*='dialog'], [class*='popover'], [class*='sheet']",
    ),
  )
    .filter(isDialogCandidate)
    .forEach(polishDialog);
}

function bootPosConfirmationPolish(): void {
  polishDialogs();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(polishDialogs, 100);
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
    document.addEventListener("DOMContentLoaded", bootPosConfirmationPolish);
  } else {
    bootPosConfirmationPolish();
  }
}

export {};

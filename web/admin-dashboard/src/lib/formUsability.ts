function labelTextFor(input: HTMLInputElement): string {
  const explicitLabel = input.id
    ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`)
    : null;
  const wrappingLabel = input.closest('label');

  return `${explicitLabel?.textContent ?? ''} ${wrappingLabel?.textContent ?? ''} ${input.placeholder ?? ''}`.toLowerCase();
}

export function applyInputKeyboardModes(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
    const label = labelTextFor(input);

    if (input.type === 'email') {
      input.inputMode = 'email';
      input.autocomplete ||= 'email';
      return;
    }

    if (input.type === 'tel' || label.includes('phone') || label.includes('mobile')) {
      input.type = 'tel';
      input.inputMode = 'tel';
      input.autocomplete ||= 'tel';
      return;
    }

    if (input.type === 'number') {
      const decimalAllowed = input.step === 'any' || input.step.includes('.') || label.includes('amount') || label.includes('price') || label.includes('cost');
      input.inputMode = decimalAllowed ? 'decimal' : 'numeric';
      return;
    }

    if (label.includes('pin') || label.includes('code')) {
      input.inputMode = 'numeric';
    }
  });
}

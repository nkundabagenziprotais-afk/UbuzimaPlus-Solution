import {
  useEffect,
} from 'react';

type WorkspacePopupFormManagerProps = {
  workspace: string;
};

type DecoratedForm = {
  form: HTMLFormElement;
  trigger: HTMLButtonElement;
  backdrop: HTMLDivElement;
  closeButton: HTMLButtonElement;
};

const actionKeywords = [
  'add',
  'approve',
  'capture',
  'complete',
  'create',
  'edit',
  'new',
  'process',
  'record',
  'reconcile',
  'refund',
  'register',
  'reject',
  'return',
  'save',
  'submit',
  'update',
];

const excludedKeywords = [
  'apply filter',
  'filter',
  'refresh',
  'search',
];

function normalise(
  value: string,
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formTitle(
  form: HTMLFormElement,
): string {
  const labelledBy =
    form.getAttribute(
      'aria-labelledby',
    );

  if (labelledBy) {
    const label =
      document.getElementById(
        labelledBy,
      );

    if (label?.textContent?.trim()) {
      return label.textContent.trim();
    }
  }

  const heading =
    form.querySelector(
      'h1, h2, h3, h4, legend',
    );

  if (heading?.textContent?.trim()) {
    return heading.textContent.trim();
  }

  const parentHeading =
    form
      .closest(
        'section, article, div',
      )
      ?.querySelector(
        ':scope > h1, :scope > h2, :scope > h3, :scope > header h1, :scope > header h2, :scope > header h3',
      );

  if (
    parentHeading?.textContent?.trim()
  ) {
    return parentHeading.textContent.trim();
  }

  const submit =
    form.querySelector<
      HTMLButtonElement |
      HTMLInputElement
    >(
      'button[type="submit"], input[type="submit"]',
    );

  const submitText =
    submit instanceof HTMLInputElement
      ? submit.value
      : submit?.textContent ?? '';

  return submitText.trim() ||
    'Open form';
}

function shouldModalise(
  form: HTMLFormElement,
): boolean {
  if (
    form.dataset.popupManaged ===
    'true'
  ) {
    return false;
  }

  if (
    form.closest(
      [
        '.module-page-navigation',
        '.professional-module-header',
        '[role="dialog"]',
        '.modal',
        '.drawer',
        '[data-no-popup-form]',
      ].join(','),
    )
  ) {
    return false;
  }

  const editableFields = [
    ...form.querySelectorAll<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >(
      'input:not([type="hidden"]):not([type="search"]), select, textarea',
    ),
  ].filter((field) => {
    const isReadOnly =
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement
        ? field.readOnly
        : false;

    return (
      !field.disabled &&
      !isReadOnly
    );
  });

  if (editableFields.length < 2) {
    return false;
  }

  const submitControls = [
    ...form.querySelectorAll<
      HTMLButtonElement |
      HTMLInputElement
    >(
      'button[type="submit"], input[type="submit"], button:not([type])',
    ),
  ];

  const actions = submitControls
    .map((control) =>
      normalise(
        control instanceof
          HTMLInputElement
          ? control.value
          : control.textContent ?? '',
      ),
    )
    .filter(Boolean);

  if (actions.length === 0) {
    return false;
  }

  const hasRecordingAction =
    actions.some((action) =>
      actionKeywords.some(
        (keyword) =>
          action.includes(keyword),
      ),
    );

  const onlyFilteringActions =
    actions.every((action) =>
      excludedKeywords.some(
        (keyword) =>
          action.includes(keyword),
      ),
    );

  return (
    hasRecordingAction &&
    !onlyFilteringActions
  );
}

export function WorkspacePopupFormManager({
  workspace,
}: WorkspacePopupFormManagerProps) {
  useEffect(() => {
    const decorated =
      new Map<
        HTMLFormElement,
        DecoratedForm
      >();

    let scheduled = false;

    const closeForm = (
      item: DecoratedForm,
    ) => {
      item.form.classList.remove(
        'is-popup-open',
      );

      item.form.setAttribute(
        'aria-hidden',
        'true',
      );

      item.backdrop.classList.remove(
        'is-open',
      );

      item.closeButton.classList.remove(
        'is-open',
      );

      document.body.classList.remove(
        'workspace-popup-lock',
      );

      item.trigger.focus();
    };

    const openForm = (
      item: DecoratedForm,
    ) => {
      decorated.forEach(
        (otherItem) => {
          if (otherItem !== item) {
            otherItem.form.classList.remove(
              'is-popup-open',
            );

            otherItem.backdrop.classList.remove(
              'is-open',
            );

            otherItem.closeButton.classList.remove(
              'is-open',
            );
          }
        },
      );

      item.form.classList.add(
        'is-popup-open',
      );

      item.form.setAttribute(
        'aria-hidden',
        'false',
      );

      item.backdrop.classList.add(
        'is-open',
      );

      item.closeButton.classList.add(
        'is-open',
      );

      document.body.classList.add(
        'workspace-popup-lock',
      );

      window.setTimeout(() => {
        const firstControl =
          item.form.querySelector<
            HTMLElement
          >(
            'input:not([type="hidden"]), select, textarea, button',
          );

        firstControl?.focus();
      }, 0);
    };

    const decorateForm = (
      form: HTMLFormElement,
    ) => {
      if (
        !shouldModalise(form)
      ) {
        return;
      }

      const title = formTitle(form);

      const trigger =
        document.createElement(
          'button',
        );

      trigger.type = 'button';
      trigger.className =
        'workspace-popup-form-trigger';

      trigger.dataset.workspace =
        workspace;

      trigger.innerHTML = [
        '<span aria-hidden="true">＋</span>',
        `<strong>${title}</strong>`,
      ].join('');

      const backdrop =
        document.createElement(
          'div',
        );

      backdrop.className =
        'workspace-popup-form-backdrop';

      backdrop.setAttribute(
        'aria-hidden',
        'true',
      );

      const closeButton =
        document.createElement(
          'button',
        );

      closeButton.type = 'button';
      closeButton.className =
        'workspace-popup-form-close';

      closeButton.setAttribute(
        'aria-label',
        `Close ${title}`,
      );

      closeButton.innerHTML =
        '<span aria-hidden="true">×</span>';

      form.dataset.popupManaged =
        'true';

      form.classList.add(
        'workspace-popup-form',
      );

      form.setAttribute(
        'aria-hidden',
        'true',
      );

      form.parentNode?.insertBefore(
        trigger,
        form,
      );

      form.parentNode?.insertBefore(
        backdrop,
        form,
      );

      form.parentNode?.insertBefore(
        closeButton,
        form,
      );

      const item = {
        form,
        trigger,
        backdrop,
        closeButton,
      };

      trigger.addEventListener(
        'click',
        () => openForm(item),
      );

      backdrop.addEventListener(
        'click',
        () => closeForm(item),
      );

      closeButton.addEventListener(
        'click',
        () => closeForm(item),
      );

      decorated.set(
        form,
        item,
      );
    };

    const scan = () => {
      scheduled = false;

      const root =
        document.querySelector(
          '.pos-unified-module-page',
        ) ??
        document.querySelector('main');

      if (!root) {
        return;
      }

      root
        .querySelectorAll<
          HTMLFormElement
        >('form')
        .forEach(decorateForm);
    };

    const scheduleScan = () => {
      if (scheduled) {
        return;
      }

      scheduled = true;

      window.requestAnimationFrame(
        scan,
      );
    };

    const observer =
      new MutationObserver(
        scheduleScan,
      );

    const root =
      document.querySelector(
        '.pos-unified-module-page',
      ) ??
      document.querySelector('main') ??
      document.body;

    observer.observe(
      root,
      {
        childList: true,
        subtree: true,
      },
    );

    scheduleScan();

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key !== 'Escape') {
        return;
      }

      decorated.forEach((item) => {
        if (
          item.form.classList.contains(
            'is-popup-open',
          )
        ) {
          closeForm(item);
        }
      });
    };

    document.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      observer.disconnect();

      document.removeEventListener(
        'keydown',
        handleEscape,
      );

      decorated.forEach((item) => {
        item.trigger.remove();
        item.backdrop.remove();
        item.closeButton.remove();

        item.form.classList.remove(
          'workspace-popup-form',
          'is-popup-open',
        );

        item.form.removeAttribute(
          'aria-hidden',
        );

        delete item.form.dataset
          .popupManaged;
      });

      document.body.classList.remove(
        'workspace-popup-lock',
      );
    };
  }, [workspace]);

  return null;
}

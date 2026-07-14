export type DuplicateReceiptErrorPayload = {
  code?: string;
  message?: string;
  duplicate?: {
    classification?: string;
    confidence_score?: number | string | null;
    match_reasons?: unknown[];
    matching_reasons?: unknown[];
    override_allowed?: boolean;
    duplicate_check_token?: string | null;
    existing_record?: {
      id?: number | null;
      quantity?: number | string | null;
      reference_number?: string | null;
      recorded_at?: string | null;
      occurred_at?: string | null;
      product?: {
        name?: string | null;
        sku?: string | null;
      } | null;
      item?: {
        name?: string | null;
        code?: string | null;
      } | null;
      batch?: {
        batch_number?: string | null;
      } | null;
      location?: {
        name?: string | null;
        code?: string | null;
      } | null;
      recorded_user?: {
        name?: string | null;
        email?: string | null;
      } | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type DuplicateProtectedReceiptPayload = {
  idempotency_key?: string;
  duplicate_override?: boolean;
  duplicate_check_token?: string | null;
  duplicate_override_reason?: string | null;
  product_id?: number;
  pharmaco_general_purchase_order_item_id?: number;
  stock_location_id?: number;
  pharmaco_general_item_location_id?: number;
  batch_number?: string | null;
  quantity?: number;
  quantity_received?: number;
  reference_number?: string | null;
  [key: string]: unknown;
};

export type DuplicateReceiptContext = {
  title: string;
  recordLabel: string;
};

type RequestError = Error & {
  status?: number;
  payload?: unknown;
};

type DuplicateDecision = {
  proceed: boolean;
  reason: string;
};

function textValue(
  value: unknown,
  fallback = 'Not recorded',
): string {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return fallback;
  }

  return String(value);
}

function formattedQuantity(
  value: unknown,
): string {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return textValue(value);
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
  }).format(parsed);
}

function formattedDate(
  value: unknown,
): string {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function readableReason(
  value: unknown,
): string {
  if (typeof value === 'string') {
    return value;
  }

  if (
    value
    && typeof value === 'object'
  ) {
    const record = value as Record<string, unknown>;

    return textValue(
      record.label
      ?? record.reason
      ?? record.message
      ?? record.code,
      'Potential duplicate signal',
    );
  }

  return textValue(
    value,
    'Potential duplicate signal',
  );
}

function addDetail(
  container: HTMLElement,
  label: string,
  value: string,
): void {
  const row = document.createElement('div');
  row.className = 'duplicate-receipt-detail';

  const labelElement =
    document.createElement('span');

  labelElement.className =
    'duplicate-receipt-detail__label';

  labelElement.textContent = label;

  const valueElement =
    document.createElement('strong');

  valueElement.className =
    'duplicate-receipt-detail__value';

  valueElement.textContent = value;

  row.append(labelElement, valueElement);
  container.append(row);
}

function focusableElements(
  container: HTMLElement,
): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[href]',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  );
}

function parseRequestError(
  error: unknown,
): {
  status: number | null;
  payload: DuplicateReceiptErrorPayload | null;
} {
  if (
    error === null
    || typeof error !== 'object'
  ) {
    return {
      status: null,
      payload: null,
    };
  }

  const requestError =
    error as RequestError;

  const status =
    typeof requestError.status === 'number'
      ? requestError.status
      : null;

  const payloadCandidate =
    requestError.payload;

  let payload:
    DuplicateReceiptErrorPayload | null = null;

  if (
    payloadCandidate !== null
    && typeof payloadCandidate === 'object'
  ) {
    payload =
      payloadCandidate as DuplicateReceiptErrorPayload;
  }

  return {
    status,
    payload,
  };
}

export function createReceiptIdempotencyKey(): string {
  if (
    typeof crypto !== 'undefined'
    && typeof crypto.randomUUID === 'function'
  ) {
    return `receipt-${crypto.randomUUID()}`;
  }

  return [
    'receipt',
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
  ].join('-');
}

async function showDuplicateDialog(
  payload: DuplicateReceiptErrorPayload,
  requestPayload: DuplicateProtectedReceiptPayload,
  context: DuplicateReceiptContext,
): Promise<DuplicateDecision> {
  const conflict = payload.duplicate ?? {};
  const existing = conflict.existing_record ?? null;

  const isExact =
    payload.code === 'EXACT_DUPLICATE'
    || conflict.classification === 'exact';

  const mayProceed =
    !isExact
    && payload.code === 'SUSPECTED_DUPLICATE'
    && conflict.override_allowed === true
    && Boolean(
      conflict.duplicate_check_token,
    );

  const previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  const previousOverflow =
    document.body.style.overflow;

  const overlay = document.createElement('div');
  overlay.className = 'duplicate-receipt-overlay';

  const dialog = document.createElement('section');
  dialog.className = 'duplicate-receipt-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute(
    'aria-labelledby',
    'duplicate-receipt-title',
  );
  dialog.setAttribute(
    'aria-describedby',
    'duplicate-receipt-description',
  );
  dialog.tabIndex = -1;

  const header = document.createElement('header');
  header.className =
    'duplicate-receipt-dialog__header';

  const headingGroup = document.createElement('div');

  const eyebrow = document.createElement('span');
  eyebrow.className = 'duplicate-receipt-eyebrow';
  eyebrow.textContent = isExact
    ? 'Duplicate receipt blocked'
    : 'Possible duplicate receipt';

  const title = document.createElement('h2');
  title.id = 'duplicate-receipt-title';
  title.className =
    'duplicate-receipt-dialog__title';
  title.textContent = context.title;

  headingGroup.append(eyebrow, title);

  const closeButton =
    document.createElement('button');

  closeButton.type = 'button';
  closeButton.className = 'duplicate-receipt-close';
  closeButton.textContent = 'Close';
  closeButton.setAttribute(
    'aria-label',
    'Close duplicate receipt review',
  );

  header.append(headingGroup, closeButton);

  const description = document.createElement('p');
  description.id =
    'duplicate-receipt-description';
  description.className =
    'duplicate-receipt-dialog__description';
  description.textContent =
    payload.message
    ?? (
      isExact
        ? 'This receipt matches an existing transaction and cannot be recorded again.'
        : 'A similar stock receipt was found. Review the existing and proposed records before proceeding.'
    );

  const comparison = document.createElement('div');
  comparison.className =
    'duplicate-receipt-comparison';

  const proposedCard =
    document.createElement('article');

  proposedCard.className =
    'duplicate-receipt-card duplicate-receipt-card--proposed';

  const proposedTitle =
    document.createElement('h3');

  proposedTitle.className =
    'duplicate-receipt-card__title';

  proposedTitle.textContent =
    'Receipt being recorded';

  const proposedDetails =
    document.createElement('div');

  proposedDetails.className =
    'duplicate-receipt-details';

  addDetail(
    proposedDetails,
    context.recordLabel,
    textValue(
      requestPayload.product_id
      ?? requestPayload
        .pharmaco_general_purchase_order_item_id,
    ),
  );

  addDetail(
    proposedDetails,
    'Quantity',
    formattedQuantity(
      requestPayload.quantity
      ?? requestPayload.quantity_received,
    ),
  );

  addDetail(
    proposedDetails,
    'Batch',
    textValue(
      requestPayload.batch_number,
      'Not applicable',
    ),
  );

  addDetail(
    proposedDetails,
    'Location',
    textValue(
      requestPayload.stock_location_id
      ?? requestPayload
        .pharmaco_general_item_location_id,
    ),
  );

  addDetail(
    proposedDetails,
    'Reference',
    textValue(
      requestPayload.reference_number,
      'Not supplied',
    ),
  );

  proposedCard.append(
    proposedTitle,
    proposedDetails,
  );

  const existingCard =
    document.createElement('article');

  existingCard.className =
    'duplicate-receipt-card duplicate-receipt-card--existing';

  const existingTitle =
    document.createElement('h3');

  existingTitle.className =
    'duplicate-receipt-card__title';

  existingTitle.textContent =
    'Existing recorded receipt';

  const existingDetails =
    document.createElement('div');

  existingDetails.className =
    'duplicate-receipt-details';

  addDetail(
    existingDetails,
    'Product or item',
    textValue(
      existing?.product?.name
      ?? existing?.item?.name,
    ),
  );

  addDetail(
    existingDetails,
    'Code',
    textValue(
      existing?.product?.sku
      ?? existing?.item?.code,
    ),
  );

  addDetail(
    existingDetails,
    'Quantity',
    formattedQuantity(existing?.quantity),
  );

  addDetail(
    existingDetails,
    'Batch',
    textValue(
      existing?.batch?.batch_number,
      'Not applicable',
    ),
  );

  addDetail(
    existingDetails,
    'Location',
    textValue(
      existing?.location?.name
      ?? existing?.location?.code,
    ),
  );

  addDetail(
    existingDetails,
    'Reference',
    textValue(
      existing?.reference_number,
      'Not supplied',
    ),
  );

  addDetail(
    existingDetails,
    'Recorded on',
    formattedDate(
      existing?.recorded_at
      ?? existing?.occurred_at,
    ),
  );

  addDetail(
    existingDetails,
    'Recorded by',
    textValue(
      existing?.recorded_user?.name
      ?? existing?.recorded_user?.email,
    ),
  );

  existingCard.append(
    existingTitle,
    existingDetails,
  );

  comparison.append(
    proposedCard,
    existingCard,
  );

  const signals = document.createElement('section');
  signals.className =
    'duplicate-receipt-signals';

  const signalsTitle =
    document.createElement('h3');

  signalsTitle.className =
    'duplicate-receipt-signals__title';

  signalsTitle.textContent =
    'Why this was flagged';

  const signalList =
    document.createElement('ul');

  signalList.className =
    'duplicate-receipt-signals__list';

  const reasons =
    conflict.match_reasons
    ?? conflict.matching_reasons
    ?? [
      'The same product or item and stock location were found in a recent receipt.',
    ];

  reasons.forEach((reason) => {
    const item = document.createElement('li');
    item.textContent = readableReason(reason);
    signalList.append(item);
  });

  signals.append(
    signalsTitle,
    signalList,
  );

  const reasonSection =
    document.createElement('div');

  reasonSection.className =
    'duplicate-receipt-reason';

  const reasonLabel =
    document.createElement('label');

  reasonLabel.className =
    'duplicate-receipt-reason__label';

  reasonLabel.htmlFor =
    'duplicate-receipt-override-reason';

  reasonLabel.textContent =
    'Reason for proceeding';

  const reasonInput =
    document.createElement('textarea');

  reasonInput.id =
    'duplicate-receipt-override-reason';

  reasonInput.className =
    'duplicate-receipt-reason__input';

  reasonInput.rows = 4;
  reasonInput.maxLength = 1000;
  reasonInput.placeholder =
    'Explain why this is a separate, verified delivery.';

  const reasonHint =
    document.createElement('p');

  reasonHint.className =
    'duplicate-receipt-reason__hint';

  reasonHint.textContent =
    'A meaningful reason of at least 10 characters is required and will be saved in the audit trail.';

  const reasonError =
    document.createElement('p');

  reasonError.className =
    'duplicate-receipt-reason__error';

  reasonError.setAttribute('role', 'alert');

  reasonSection.append(
    reasonLabel,
    reasonInput,
    reasonHint,
    reasonError,
  );

  reasonSection.hidden = !mayProceed;

  const footer = document.createElement('footer');
  footer.className =
    'duplicate-receipt-dialog__footer';

  const cancelButton =
    document.createElement('button');

  cancelButton.type = 'button';
  cancelButton.className =
    'button secondary duplicate-receipt-action';

  cancelButton.textContent = isExact
    ? 'Close review'
    : 'Cancel receipt';

  const proceedButton =
    document.createElement('button');

  proceedButton.type = 'button';
  proceedButton.className =
    'button primary duplicate-receipt-action duplicate-receipt-action--proceed';

  proceedButton.textContent =
    'Proceed with recording';

  proceedButton.hidden = !mayProceed;

  footer.append(
    cancelButton,
    proceedButton,
  );

  dialog.append(
    header,
    description,
    comparison,
    signals,
    reasonSection,
    footer,
  );

  overlay.append(dialog);
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';

  return new Promise<DuplicateDecision>(
    (resolve) => {
      let settled = false;

      const cleanup = (
        decision: DuplicateDecision,
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        document.removeEventListener(
          'keydown',
          onKeyDown,
        );

        overlay.remove();

        document.body.style.overflow =
          previousOverflow;

        previousFocus?.focus();

        resolve(decision);
      };

      const cancel = () => {
        cleanup({
          proceed: false,
          reason: '',
        });
      };

      const proceed = () => {
        const reason = reasonInput.value.trim();

        if (reason.length < 10) {
          reasonError.textContent =
            'Enter at least 10 characters explaining why this is a separate verified receipt.';

          reasonInput.focus();
          return;
        }

        reasonError.textContent = '';

        cleanup({
          proceed: true,
          reason,
        });
      };

      const onKeyDown = (
        event: KeyboardEvent,
      ) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
          return;
        }

        if (event.key !== 'Tab') {
          return;
        }

        const focusable =
          focusableElements(dialog);

        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusable[0];
        const last =
          focusable[focusable.length - 1];

        if (
          event.shiftKey
          && document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey
          && document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      };

      closeButton.addEventListener(
        'click',
        cancel,
      );

      cancelButton.addEventListener(
        'click',
        cancel,
      );

      proceedButton.addEventListener(
        'click',
        proceed,
      );

      overlay.addEventListener(
        'mousedown',
        (event) => {
          if (event.target === overlay) {
            cancel();
          }
        },
      );

      document.addEventListener(
        'keydown',
        onKeyDown,
      );

      requestAnimationFrame(() => {
        if (mayProceed) {
          reasonInput.focus();
        } else {
          cancelButton.focus();
        }
      });
    },
  );
}

export async function runDuplicateProtectedReceipt<
  TPayload extends object,
  TResponse,
>(
  payload: TPayload,
  submit: (
    nextPayload: TPayload,
  ) => Promise<TResponse>,
  context: DuplicateReceiptContext,
): Promise<TResponse> {
  const protectedPayload =
    payload as TPayload
      & DuplicateProtectedReceiptPayload;

  const idempotencyKey =
    protectedPayload.idempotency_key?.trim()
    || createReceiptIdempotencyKey();

  const initialPayload = {
    ...protectedPayload,
    idempotency_key: idempotencyKey,
  } as TPayload & DuplicateProtectedReceiptPayload;

  try {
    return await submit(
      initialPayload as TPayload,
    );
  } catch (error) {
    const parsed = parseRequestError(error);
    const conflict = parsed.payload;
    const code = conflict?.code;

    if (
      parsed.status !== 409
      || !conflict
      || (
        code !== 'EXACT_DUPLICATE'
        && code !== 'SUSPECTED_DUPLICATE'
      )
    ) {
      throw error;
    }

    const decision =
      await showDuplicateDialog(
        conflict,
        initialPayload,
        context,
      );

    if (!decision.proceed) {
      throw new Error(
        code === 'EXACT_DUPLICATE'
          ? (
            conflict.message
            ?? 'Duplicate receipt blocked. No stock movement was created.'
          )
          : 'Receipt cancelled. No stock movement was created.',
      );
    }

    const token =
      conflict.duplicate
        ?.duplicate_check_token;

    if (!token) {
      throw new Error(
        'The duplicate confirmation token is unavailable. Refresh the receipt and try again.',
      );
    }

    const overridePayload = {
      ...initialPayload,
      duplicate_override: true,
      duplicate_check_token: token,
      duplicate_override_reason:
        decision.reason,
    } as TPayload & DuplicateProtectedReceiptPayload;

    return submit(
      overridePayload as TPayload,
    );
  }
}

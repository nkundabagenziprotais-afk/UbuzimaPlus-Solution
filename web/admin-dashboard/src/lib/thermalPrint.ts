export type ThermalPaperWidth = 58 | 80;

export type ThermalPrintOptions = {
  documentTitle?: string;
  paperWidthMm?: ThermalPaperWidth;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function nextRenderFrame(
  targetWindow: Window,
): Promise<void> {
  return new Promise((resolve) => {
    targetWindow.requestAnimationFrame(
      () => resolve(),
    );
  });
}

async function waitForReceiptImages(
  targetDocument: Document,
): Promise<void> {
  await Promise.all(
    Array.from(targetDocument.images).map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const finish = () => resolve();

          image.addEventListener(
            'load',
            finish,
            { once: true },
          );

          image.addEventListener(
            'error',
            finish,
            { once: true },
          );
        }),
    ),
  );
}

export async function printThermalElement(
  elementId: string,
  options: ThermalPrintOptions = {},
): Promise<void> {
  const source = document.getElementById(
    elementId,
  );

  if (!source) {
    throw new Error(
      'The customer receipt is not available for printing.',
    );
  }

  const productLines =
    source.querySelectorAll(
      '[data-pos-receipt-line="true"]',
    );

  if (productLines.length === 0) {
    throw new Error(
      'The receipt product information is still loading. Refresh the transaction before printing.',
    );
  }

  const text = (
    source.textContent ?? ''
  )
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length < 20) {
    throw new Error(
      'The customer receipt has no transaction information.',
    );
  }

  const paperWidth =
    options.paperWidthMm ?? 80;

  const contentWidth =
    paperWidth === 58 ? 52 : 72;

  const frame =
    document.createElement('iframe');

  frame.title =
    'Thermal receipt print frame';

  frame.setAttribute(
    'aria-hidden',
    'true',
  );

  Object.assign(
    frame.style,
    {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '1px',
      height: '1px',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
    },
  );

  document.body.appendChild(frame);

  const printWindow =
    frame.contentWindow;

  const printDocument =
    frame.contentDocument;

  if (!printWindow || !printDocument) {
    frame.remove();

    throw new Error(
      'The receipt print document could not be created.',
    );
  }

  const title = escapeHtml(
    options.documentTitle
      ?? 'Customer receipt',
  );

  printDocument.open();

  printDocument.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: ${paperWidth}mm auto;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: ${paperWidth}mm;
      min-width: ${paperWidth}mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }

    .thermal-print-root {
      width: ${contentWidth}mm;
      max-width: ${contentWidth}mm;
      margin: 0 auto;
      padding: 3mm 0 5mm;
    }

    .pos-thermal-receipt-source {
      position: static !important;
      inset: auto !important;
      left: auto !important;
      width: 100% !important;
      max-width: 100% !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      background: #ffffff !important;
      color: #111111 !important;
    }

    .pos-thermal-receipt__header {
      text-align: center;
      padding-bottom: 2.5mm;
      border-bottom: 1px dashed #222222;
    }

    .pos-thermal-receipt__header strong,
    .pos-thermal-receipt__header span,
    .pos-thermal-receipt__header small,
    td small,
    .pos-thermal-receipt__footer small {
      display: block;
    }

    .pos-thermal-receipt__meta {
      padding: 2mm 0;
      border-bottom: 1px dashed #222222;
    }

    .pos-thermal-receipt__meta div,
    .pos-thermal-receipt__total-row {
      display: flex;
      justify-content: space-between;
      gap: 3mm;
      padding: 0.6mm 0;
    }

    .pos-thermal-receipt__meta span,
    .pos-thermal-receipt__total-row span {
      flex: 0 0 34%;
    }

    .pos-thermal-receipt__meta strong,
    .pos-thermal-receipt__total-row strong {
      flex: 1;
      text-align: right;
      overflow-wrap: anywhere;
    }

    table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin: 2mm 0;
    }

    th,
    td {
      padding: 1mm 0.4mm;
      vertical-align: top;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    th:first-child,
    td:first-child {
      width: 58%;
      text-align: left;
    }

    th:nth-child(2),
    td:nth-child(2) {
      width: 14%;
      text-align: center;
    }

    th:last-child,
    td:last-child {
      width: 28%;
      text-align: right;
    }

    thead {
      border-bottom: 1px solid #222222;
    }

    .pos-thermal-receipt__totals {
      padding-top: 1.5mm;
      border-top: 1px dashed #222222;
    }

    .pos-thermal-receipt__total-row--grand {
      margin-top: 1mm;
      padding-top: 1.5mm;
      border-top: 1px solid #222222;
      font-size: 13px;
      font-weight: 700;
    }

    .pos-thermal-receipt__footer {
      margin-top: 3mm;
      padding-top: 2mm;
      text-align: center;
      border-top: 1px dashed #222222;
    }
  </style>
</head>
<body>
  <main class="thermal-print-root">
    ${source.outerHTML}
  </main>
</body>
</html>`);

  printDocument.close();

  try {
    await waitForReceiptImages(
      printDocument,
    );

    if (
      'fonts' in printDocument
      && printDocument.fonts
    ) {
      await printDocument.fonts.ready;
    }

    await nextRenderFrame(printWindow);
    await nextRenderFrame(printWindow);

    const renderedLines =
      printDocument.querySelectorAll(
        '[data-pos-receipt-line="true"]',
      );

    const renderedReceipt =
      printDocument.querySelector(
        '.thermal-print-root',
      );

    if (
      !renderedReceipt
      || renderedLines.length === 0
      || (
        renderedReceipt.textContent
        ?? ''
      ).trim().length < 20
    ) {
      throw new Error(
        'The receipt print document rendered without its transaction products.',
      );
    }

    const removeFrame = () => {
      window.setTimeout(
        () => frame.remove(),
        250,
      );
    };

    printWindow.addEventListener(
      'afterprint',
      removeFrame,
      { once: true },
    );

    printWindow.focus();
    printWindow.print();

    window.setTimeout(
      () => {
        if (frame.isConnected) {
          frame.remove();
        }
      },
      30000,
    );
  } catch (error) {
    frame.remove();
    throw error;
  }
}

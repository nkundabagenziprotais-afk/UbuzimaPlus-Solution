import '../enterprise-operations.css';
import {
  closePosSession,
  getActiveBranches,
  getCurrentPosSession,
  getPosSessionTransactions,
  getSellableBatches,
  openPosSession,
  postConfirmedPosSale,
  readEnterpriseStoredSession,
  type PosTransaction,
} from './posEnterpriseApi';

function labelTextFor(input: HTMLInputElement): string {
  const explicitLabel = input.id
    ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`)
    : null;
  const wrappingLabel = input.closest('label');

  return `${explicitLabel?.textContent ?? ''} ${wrappingLabel?.textContent ?? ''} ${input.placeholder ?? ''}`.toLowerCase();
}

let enterpriseHandlersInstalled = false;
let posSessionSyncInFlight = false;
let transactionLoadInFlight = false;
let cachedTransactions: PosTransaction[] = [];
const bypassedButtons = new WeakSet<HTMLButtonElement>();

function normalizedText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function numericText(value: string | null | undefined): number {
  const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findField(scope: ParentNode, label: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  const wanted = normalizedText(label);
  const labels = Array.from(scope.querySelectorAll<HTMLLabelElement>('label'));
  const matched = labels.find((candidate) => normalizedText(candidate.textContent).includes(wanted));
  return matched?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea') ?? null;
}

function notify(message: string, tone: 'success' | 'error' | 'info' = 'info'): void {
  let toast = document.querySelector<HTMLDivElement>('.enterprise-operation-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'enterprise-operation-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }

  toast.className = `enterprise-operation-toast enterprise-operation-toast--${tone}`;
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => {
    if (toast) toast.hidden = true;
  }, tone === 'error' ? 6500 : 4000);
}

function setButtonBusy(button: HTMLButtonElement, busy: boolean, busyLabel: string): void {
  if (busy) {
    button.dataset.enterpriseOriginalLabel = button.textContent || '';
    button.textContent = busyLabel;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    return;
  }

  button.textContent = button.dataset.enterpriseOriginalLabel || button.textContent;
  button.disabled = false;
  button.removeAttribute('aria-busy');
}

function triggerReactButton(button: HTMLButtonElement): void {
  bypassedButtons.add(button);
  button.disabled = false;
  button.click();
}

function assignedBranchId(): number | null {
  const session = readEnterpriseStoredSession();
  return session?.profile.tenant_assignments?.[0]?.branch?.id ?? null;
}

async function resolveBranchId(): Promise<number> {
  const session = readEnterpriseStoredSession();
  if (!session) throw new Error('Your authenticated session could not be read. Sign in again.');

  const assigned = assignedBranchId();
  if (assigned) return assigned;

  const branches = await getActiveBranches(session);
  if (!branches[0]) throw new Error('No active pharmacy branch is available for this POS session.');
  return branches[0].id;
}

function zeroizationControl(scope: HTMLElement): HTMLInputElement | null {
  const existing = Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((input) =>
    normalizedText(input.closest('label')?.textContent).includes('zero'),
  );
  return existing ?? scope.querySelector<HTMLInputElement>('input[data-enterprise-zeroization]');
}

function ensureCloseReconciliationFields(): void {
  const closeCard = document.querySelector<HTMLElement>('.pos-shift-card--close');
  if (!closeCard) return;

  let zero = zeroizationControl(closeCard);
  if (!zero) {
    const label = document.createElement('label');
    label.className = 'pos-shift-check enterprise-zeroization-check';
    label.innerHTML = '<input type="checkbox" data-enterprise-zeroization><span>Till fully zeroized and cash removed from the drawer</span>';
    closeCard.insertBefore(label, closeCard.querySelector('button'));
    zero = label.querySelector('input');
  }

  if (!closeCard.querySelector('[data-enterprise-counted-cash]')) {
    const reconciliation = document.createElement('div');
    reconciliation.className = 'enterprise-close-reconciliation-grid';
    reconciliation.innerHTML = `
      <label class="pos-shift-field">
        <span>Counted cash for reconciliation</span>
        <input type="number" min="0" step="0.01" value="0" data-enterprise-counted-cash>
      </label>
      <label class="pos-shift-field">
        <span>Closing till balance</span>
        <input type="number" min="0" step="0.01" value="0" data-enterprise-closing-balance>
        <small>Must be exactly zero before clock-out.</small>
      </label>
    `;
    closeCard.insertBefore(reconciliation, closeCard.querySelector('button'));
  }
}

async function handleOpenDay(button: HTMLButtonElement): Promise<void> {
  const auth = readEnterpriseStoredSession();
  if (!auth) throw new Error('Your authenticated session could not be read. Sign in again.');

  setButtonBusy(button, true, 'Opening…');
  try {
    const current = await getCurrentPosSession(auth);
    if (current.session?.status === 'closed') {
      throw new Error('Your POS session was already closed today. It cannot be reopened until the next business day.');
    }
    if (current.session?.status === 'open') {
      triggerReactButton(button);
      notify(`POS session already open since ${new Date(current.session.opened_at).toLocaleTimeString()}.`, 'info');
      return;
    }

    const card = button.closest<HTMLElement>('.pos-shift-card') ?? document;
    const openingMode = (findField(card, 'opening mode') as HTMLSelectElement | null)?.value || 'fresh-start';
    const startingCash = numericText((findField(card, 'starting cash balance') as HTMLInputElement | null)?.value);
    const branchId = await resolveBranchId();
    const opened = await openPosSession(auth, {
      branch_id: branchId,
      opening_mode: openingMode.replace('-', '_'),
      starting_cash: startingCash,
      opening_note: 'Opened from the Ubuzima+ enterprise POS counter.',
    });

    triggerReactButton(button);
    notify(opened.message, 'success');
    await loadAndRenderTransactions(true);
  } finally {
    setButtonBusy(button, false, 'Opening…');
  }
}

async function handleCloseDay(button: HTMLButtonElement): Promise<void> {
  const auth = readEnterpriseStoredSession();
  if (!auth) throw new Error('Your authenticated session could not be read. Sign in again.');

  const card = button.closest<HTMLElement>('.pos-shift-card') ?? document.body;
  const closeModeField = findField(card, 'closing mode') as HTMLSelectElement | null;
  const closeMode = closeModeField?.value || 'handover';
  const zeroized = Boolean(zeroizationControl(card)?.checked);
  const countedCash = numericText(card.querySelector<HTMLInputElement>('[data-enterprise-counted-cash]')?.value);
  const closingBalance = numericText(card.querySelector<HTMLInputElement>('[data-enterprise-closing-balance]')?.value);
  const depositReference = (findField(card, 'deposit proof reference') as HTMLInputElement | null)?.value?.trim() || null;

  if (!zeroized) throw new Error('Clock-out is blocked until the till is fully zeroized and acknowledged.');
  if (closingBalance !== 0) throw new Error('Clock-out is blocked. Closing till balance must be exactly zero.');
  if (closeMode === 'final-close' && !depositReference) {
    throw new Error('Final close requires a deposit proof reference.');
  }

  setButtonBusy(button, true, 'Reconciling…');
  try {
    const closed = await closePosSession(auth, {
      close_mode: closeMode.replace('-', '_'),
      till_zeroized: true,
      closing_cash_balance: 0,
      counted_cash: countedCash,
      deposit_reference: depositReference,
      closing_note: 'Closed from the Ubuzima+ enterprise POS counter after zeroization.',
    });
    triggerReactButton(button);
    button.disabled = true;
    const openButton = document.querySelector<HTMLButtonElement>('.pos-shift-card--open button');
    if (openButton) openButton.disabled = true;
    notify(
      `${closed.message} Variance: RWF ${(closed.session.cash_variance ?? 0).toLocaleString('en-RW')}.`,
      'success',
    );
  } finally {
    setButtonBusy(button, false, 'Reconciling…');
  }
}

function readSummaryValue(label: string): number {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.pos-summary-field-card'));
  const card = cards.find((candidate) => normalizedText(candidate.querySelector('span')?.textContent) === normalizedText(label));
  return numericText(card?.querySelector('strong')?.textContent);
}

function readCartRows(): Array<{ name: string; quantity: number; lineTotal: number }> {
  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('.pos-cart-table tbody tr'));
  return rows
    .map((row) => {
      const cells = row.querySelectorAll<HTMLTableCellElement>('td');
      const name = cells[0]?.querySelector('strong')?.textContent?.trim() || '';
      const quantity = Number(cells[1]?.querySelector<HTMLInputElement>('input')?.value || 0);
      const lineTotal = numericText(cells[2]?.textContent);
      return { name, quantity, lineTotal };
    })
    .filter((row) => row.name && row.quantity > 0);
}

async function handleConfirmPayment(button: HTMLButtonElement): Promise<void> {
  if (button.dataset.enterprisePersisted === 'true') {
    triggerReactButton(button);
    return;
  }

  const auth = readEnterpriseStoredSession();
  if (!auth) throw new Error('Your authenticated session could not be read. Sign in again.');
  const current = await getCurrentPosSession(auth);
  if (!current.session || current.session.status !== 'open') {
    throw new Error('Open your controlled POS session before confirming a sale.');
  }

  const cart = readCartRows();
  if (!cart.length) throw new Error('Add at least one product before confirming payment.');

  setButtonBusy(button, true, 'Posting sale…');
  try {
    const batches = await getSellableBatches(auth);
    const usedBatchIds = new Set<number>();
    const prescriptionStatus = (findField(document, 'prescription') as HTMLSelectElement | null)?.value || 'not-required';
    const configuredItems = cart.map((row) => {
      const name = normalizedText(row.name);
      const candidates = batches
        .filter((batch) => normalizedText(batch.product?.name) === name && !usedBatchIds.has(batch.id))
        .filter((batch) => Number(batch.available_quantity || 0) >= row.quantity)
        .sort((left, right) => String(left.expiry_date || '9999').localeCompare(String(right.expiry_date || '9999')));
      const selected = candidates[0];
      if (!selected) throw new Error(`${row.name} no longer has enough sellable FEFO stock.`);
      if (selected.product.requires_prescription && prescriptionStatus !== 'captured') {
        throw new Error(`${row.name} requires a captured and pharmacist-verified prescription.`);
      }
      usedBatchIds.add(selected.id);
      return {
        productId: selected.product.id,
        stockBatchId: selected.id,
        quantity: row.quantity,
        unitPrice: row.lineTotal > 0 ? row.lineTotal / row.quantity : Number(selected.selling_price || 0),
        requiresPrescription: Boolean(selected.product.requires_prescription),
        prescriptionVerified: prescriptionStatus === 'captured',
      };
    });

    const paymentMethodField = findField(document, 'payment method') as HTMLSelectElement | null;
    const paymentMethod = (paymentMethodField?.value || 'cash') as 'cash' | 'momo' | 'card' | 'insurance' | 'credit';
    await postConfirmedPosSale(auth, {
      branchId: current.session.branch?.id || (await resolveBranchId()),
      paymentMethod,
      discountAmount: readSummaryValue('Discount'),
      taxAmount: readSummaryValue('Tax'),
      items: configuredItems,
    });

    button.dataset.enterprisePersisted = 'true';
    triggerReactButton(button);
    notify('Sale, stock deduction, payment, receipt and session transaction were posted successfully.', 'success');
    await loadAndRenderTransactions(true);
  } finally {
    setButtonBusy(button, false, 'Posting sale…');
  }
}

function formatMoney(value: number): string {
  return `RWF ${Number(value || 0).toLocaleString('en-RW', { maximumFractionDigits: 0 })}`;
}

function renderTransactionRows(transactions: PosTransaction[]): void {
  const section = document.querySelector<HTMLElement>('.pos-recent-transactions-bottom');
  const body = section?.querySelector<HTMLTableSectionElement>('tbody');
  if (!section || !body) return;

  const search = normalizedText(section.querySelector<HTMLInputElement>('input[aria-label*="Search"]')?.value);
  const filter = section.querySelector<HTMLSelectElement>('select[aria-label*="Filter"]')?.value || 'current-session';
  const filtered = transactions.filter((transaction) => {
    const matchesSearch = !search || normalizedText([
      transaction.sale_number,
      transaction.receipt_number,
      transaction.customer,
      transaction.payment_method,
      transaction.payment_status,
    ].join(' ')).includes(search);
    const matchesFilter = filter === 'current-session'
      || (filter === 'paid' && transaction.payment_status === 'paid')
      || (filter === 'pending' && transaction.payment_status !== 'paid')
      || (filter === 'invoice' && Boolean(transaction.receipt_number));
    return matchesSearch && matchesFilter;
  });

  body.innerHTML = '';
  if (!filtered.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.className = 'enterprise-empty-table-cell';
    cell.textContent = transactions.length
      ? 'No transaction matches the selected search and filter.'
      : 'No transactions have been posted in this controlled POS session.';
    return;
  }

  filtered.forEach((transaction) => {
    const row = body.insertRow();
    row.dataset.transactionId = String(transaction.id);
    const date = transaction.date_time ? new Date(transaction.date_time) : null;
    const values = [
      date ? date.toLocaleString('en-RW') : '—',
      transaction.sale_number || transaction.receipt_number || '—',
      transaction.customer || 'Walk-in',
      transaction.payment_method.replaceAll('_', ' '),
      transaction.payment_status.replaceAll('_', ' '),
      formatMoney(transaction.total_amount),
    ];
    values.forEach((value, index) => {
      const cell = row.insertCell();
      cell.textContent = value;
      if (index === 4) {
        const badge = document.createElement('span');
        badge.className = `enterprise-status-badge status--${statusTone(value)}`;
        badge.innerHTML = `<i aria-hidden="true"></i>${value}`;
        cell.textContent = '';
        cell.appendChild(badge);
      }
    });
  });
}

async function loadAndRenderTransactions(force = false): Promise<void> {
  const section = document.querySelector<HTMLElement>('.pos-recent-transactions-bottom');
  const auth = readEnterpriseStoredSession();
  if (!section || !auth || transactionLoadInFlight) return;

  const loadedAt = Number(section.dataset.enterpriseLoadedAt || 0);
  if (!force && Date.now() - loadedAt < 10_000) {
    renderTransactionRows(cachedTransactions);
    return;
  }

  transactionLoadInFlight = true;
  try {
    const response = await getPosSessionTransactions(auth);
    cachedTransactions = response.transactions || [];
    section.dataset.enterpriseLoadedAt = String(Date.now());
    renderTransactionRows(cachedTransactions);
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Unable to load recent POS transactions.', 'error');
  } finally {
    transactionLoadInFlight = false;
  }
}

function exportTransactions(): void {
  const header = ['Date/Time', 'Sale No.', 'Receipt No.', 'Customer', 'Payment Method', 'Payment Status', 'Subtotal', 'Tax', 'Total'];
  const lines = cachedTransactions.map((transaction) => [
    transaction.date_time || '',
    transaction.sale_number,
    transaction.receipt_number || '',
    transaction.customer,
    transaction.payment_method,
    transaction.payment_status,
    transaction.subtotal_amount,
    transaction.tax_amount,
    transaction.total_amount,
  ]);
  const csv = [header, ...lines]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `pos-session-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function statusTone(status: string): string {
  const text = normalizedText(status);
  if (/(expired|critical|stock-out|cancel|failed|overdue|blocked|depleted)/.test(text)) return 'danger';
  if (/(near|watch|pending|partial|review|warning|low|draft)/.test(text)) return 'warning';
  if (/(active|safe|paid|approved|available|completed|dispensed|open|received)/.test(text)) return 'success';
  return 'neutral';
}

function enhanceStatusColumns(root: ParentNode): void {
  root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
    headers.forEach((header, index) => {
      if (normalizedText(header.textContent) !== 'status') return;
      header.classList.add('enterprise-status-column-heading');
      table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
        const cell = row.cells.item(index);
        if (!cell || cell.querySelector('.enterprise-status-badge')) return;
        const status = cell.textContent?.trim() || 'Not set';
        const badge = document.createElement('span');
        badge.className = `enterprise-status-badge status--${statusTone(status)}`;
        badge.setAttribute('aria-label', `Status: ${status}`);
        badge.innerHTML = `<i aria-hidden="true"></i><span>${status}</span>`;
        cell.textContent = '';
        cell.appendChild(badge);
      });
    });
  });
}

function enhanceModuleHeaders(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.section-page').forEach((page) => {
    page.classList.add('enterprise-module-shell');
    const header = page.querySelector<HTMLElement>(
      ':scope > .module-page-intro, :scope > .pos-dedicated-command-bar, :scope > section > .section-heading, :scope > article.panel > .panel-heading-row, :scope > section:first-child',
    );
    header?.classList.add('enterprise-module-header');
  });
}

function enhanceOperationalForms(root: ParentNode): void {
  const auth = readEnterpriseStoredSession();
  root.querySelectorAll<HTMLFormElement>('form').forEach((form) => {
    if (form.closest('.auth-shell') || form.classList.contains('login-form')) return;
    form.classList.add('enterprise-record-form');
    const dialog = form.closest<HTMLElement>('[role="dialog"], dialog, .modal, .overlay, [class*="dialog"], [class*="overlay"]');
    if (dialog) dialog.classList.add('enterprise-form-dialog');

    const actionArea = Array.from(form.querySelectorAll<HTMLElement>('div, footer')).find((candidate) =>
      Array.from(candidate.children).some((child) => child instanceof HTMLButtonElement),
    );
    actionArea?.classList.add('enterprise-form-actions');

    const canWrite = Boolean(auth?.profile.permissions.some((permission) =>
      /(?:manage|\.add|\.edit|\.create|\.update)$/.test(permission),
    ));
    form.querySelectorAll<HTMLButtonElement>('button[type="submit"], button[data-save]').forEach((button) => {
      if (!canWrite) {
        button.disabled = true;
        button.title = 'Your role does not have permission to save this record.';
      }
    });
  });
}

function suppressCommunicationSubmenus(root: ParentNode): void {
  ['notifications', 'pharmacist-chat'].forEach((key) => {
    const section = root.querySelector<HTMLElement>(`.principal-menu-section[data-principal-menu="${key}"]`);
    if (!section) return;
    section.classList.add('principal-menu-section--direct');
    section.querySelector<HTMLElement>('.principal-menu-toggle-sign')?.setAttribute('hidden', 'true');
    section.querySelector<HTMLElement>('.tree-child-submenu')?.setAttribute('hidden', 'true');
    const button = section.querySelector<HTMLButtonElement>('.principal-menu-button');
    button?.setAttribute('aria-expanded', 'false');
  });
}

function ensureReceiptButton(): void {
  const summary = document.querySelector<HTMLElement>('.pos-summary-confirmation-card');
  if (!summary || summary.querySelector('[data-enterprise-print-receipt]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.enterprisePrintReceipt = 'true';
  button.className = 'secondary-action enterprise-receipt-button';
  button.textContent = 'Print 80 mm Receipt';
  summary.appendChild(button);
}

function receiptHtml(transaction: PosTransaction | null): string {
  const auth = readEnterpriseStoredSession();
  const tenant = auth?.profile.tenant_assignments?.[0]?.tenant?.name || 'Pharmacy';
  const branch = auth?.profile.tenant_assignments?.[0]?.branch?.name || transaction?.customer || 'Main Branch';
  const items = transaction?.items?.length
    ? transaction.items
    : readCartRows().map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.quantity ? item.lineTotal / item.quantity : 0,
        line_total: item.lineTotal,
      }));
  const subtotal = transaction?.subtotal_amount ?? readSummaryValue('Sub-Total');
  const tax = transaction?.tax_amount ?? readSummaryValue('Tax');
  const discount = transaction?.discount_amount ?? readSummaryValue('Discount');
  const total = transaction?.total_amount ?? readSummaryValue('Total Amount');
  const receipt = transaction?.receipt_number || transaction?.sale_number || `POS-${Date.now()}`;
  const date = transaction?.date_time ? new Date(transaction.date_time) : new Date();
  const logo = document.querySelector<HTMLImageElement>('.sidebar-logo, .auth-logo')?.src || '/assets/vitapharma-logo.png';
  const controlled = items.some((item) => /morphine|codeine|tramadol|diazepam|controlled/i.test(item.name));

  return `<!doctype html><html><head><meta charset="utf-8"><title>${receipt}</title><style>
    @page{size:80mm auto;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font-family:"Courier New",monospace;font-size:10px;line-height:1.32}.receipt{width:80mm;max-width:80mm;padding:4mm 4mm 7mm}.center{text-align:center}.logo{display:block;max-width:60mm;max-height:17mm;margin:0 auto 2mm;object-fit:contain}.rule{border-top:1px dashed #111;margin:2.2mm 0}.meta{display:grid;grid-template-columns:1fr 1fr;gap:1mm}.meta span:nth-child(even){text-align:right}.items{width:100%;border-collapse:collapse;table-layout:fixed}.items th,.items td{padding:1mm 0;vertical-align:top}.items th{text-align:left;border-bottom:1px solid #111}.items th:nth-child(2),.items td:nth-child(2){width:13mm;text-align:center}.items th:last-child,.items td:last-child{width:20mm;text-align:right}.totals{margin-left:auto;width:54mm}.totals div{display:flex;justify-content:space-between;padding:.6mm 0}.totals .grand{font-weight:700;font-size:12px;border-top:1px solid #111;border-bottom:1px double #111;margin-top:1mm;padding:1.2mm 0}.signature{height:16mm;border-bottom:1px solid #111;margin:2mm 0 1mm}.barcode{height:12mm;margin:2mm auto 1mm;background:repeating-linear-gradient(90deg,#111 0,#111 1px,transparent 1px,transparent 3px,#111 3px,#111 5px,transparent 5px,transparent 7px);width:64mm}.small{font-size:8px}.no-print{margin-top:4mm}@media print{.no-print{display:none}}</style></head><body><main class="receipt">
    <img class="logo" src="${logo}" alt="${tenant}"><div class="center"><strong>${tenant}</strong><br>${branch}<br>Rwanda</div><div class="rule"></div>
    <div class="meta"><span>Date: ${date.toLocaleDateString('en-RW')}</span><span>Time: ${date.toLocaleTimeString('en-RW')}</span><span>Receipt: ${receipt}</span><span>Cashier: ${auth?.profile.user.name || 'Staff'}</span><span>Rx #: ${transaction?.prescription_number || 'N/A'}</span><span>Method: ${(transaction?.payment_method || (findField(document, 'payment method') as HTMLSelectElement | null)?.value || 'cash').toUpperCase()}</span></div><div class="rule"></div>
    <table class="items"><thead><tr><th>ITEM</th><th>QTY</th><th>PRICE</th></tr></thead><tbody>${items.map((item) => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${formatMoney(item.line_total)}</td></tr>`).join('')}</tbody></table><div class="rule"></div>
    <section class="totals"><div><span>SUBTOTAL</span><strong>${formatMoney(subtotal)}</strong></div><div><span>DISCOUNT</span><strong>${formatMoney(discount)}</strong></div><div><span>TAX (Medical)</span><strong>${formatMoney(tax)}</strong></div><div class="grand"><span>TOTAL</span><strong>${formatMoney(total)}</strong></div></section>
    ${controlled ? '<div class="rule"></div><div class="center"><strong>PATIENT SIGNATURE REQUIRED</strong></div><div class="signature">X</div>' : ''}
    <div class="rule"></div><div class="center">Keep this receipt for tax, insurance and return tracking.</div><div class="barcode"></div><div class="center small">${receipt}</div><button class="no-print" onclick="window.print()">Print receipt</button>
  </main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
}

function printReceipt(): void {
  const transaction = cachedTransactions[0] || null;
  const popup = window.open('', '_blank', 'width=420,height=760,noopener,noreferrer');
  if (!popup) {
    notify('Receipt window was blocked. Allow pop-ups for this POS and try again.', 'error');
    return;
  }
  popup.document.open();
  popup.document.write(receiptHtml(transaction));
  popup.document.close();
}

async function synchronizePosSessionControls(): Promise<void> {
  const openButton = document.querySelector<HTMLButtonElement>('.pos-shift-card--open button');
  const closeButton = document.querySelector<HTMLButtonElement>('.pos-shift-card--close button');
  const auth = readEnterpriseStoredSession();
  if (!openButton || !closeButton || !auth || posSessionSyncInFlight) return;
  if (openButton.dataset.enterpriseSessionSynced === new Date().toISOString().slice(0, 10)) return;

  posSessionSyncInFlight = true;
  try {
    const current = await getCurrentPosSession(auth);
    openButton.dataset.enterpriseSessionSynced = new Date().toISOString().slice(0, 10);
    if (current.session?.status === 'open') {
      openButton.disabled = true;
      openButton.textContent = 'Opened Today';
      if (closeButton.disabled) triggerReactButton(openButton);
      closeButton.disabled = false;
    } else if (current.session?.status === 'closed') {
      openButton.disabled = true;
      openButton.textContent = 'Closed for Today';
      closeButton.disabled = true;
      closeButton.textContent = 'Clock-out Completed';
    }
  } catch {
    // The normal API error surface remains available; do not block the page during initial sync.
  } finally {
    posSessionSyncInFlight = false;
  }
}

function enhanceRecentTransactions(): void {
  const section = document.querySelector<HTMLElement>('.pos-recent-transactions-bottom');
  if (!section) return;
  section.classList.add('enterprise-transaction-register');
  const search = section.querySelector<HTMLInputElement>('input[aria-label*="Search"]');
  const filter = section.querySelector<HTMLSelectElement>('select[aria-label*="Filter"]');
  if (search && !search.dataset.enterpriseBound) {
    search.dataset.enterpriseBound = 'true';
    search.addEventListener('input', () => renderTransactionRows(cachedTransactions));
  }
  if (filter && !filter.dataset.enterpriseBound) {
    filter.dataset.enterpriseBound = 'true';
    filter.addEventListener('change', () => renderTransactionRows(cachedTransactions));
  }
  void loadAndRenderTransactions();
}

function installEnterpriseHandlers(): void {
  if (enterpriseHandlersInstalled) return;
  enterpriseHandlersInstalled = true;

  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button');
    if (!button) return;

    if (bypassedButtons.has(button)) {
      bypassedButtons.delete(button);
      return;
    }

    const text = normalizedText(button.textContent);
    const inPos = Boolean(button.closest('.pos-unified-module-page, .pos-executive-overview, .pos-terminal-main-scroll'));

    if (inPos && (text === 'open day' || text === 'clock in')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void handleOpenDay(button).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Unable to open POS day.', 'error'));
      return;
    }

    if (inPos && (text === 'close day' || text === 'clock out')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void handleCloseDay(button).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Unable to close POS day.', 'error'));
      return;
    }

    if (inPos && (text === 'confirm payment' || text === 'payment confirmed')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void handleConfirmPayment(button).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Unable to post the POS sale.', 'error'));
      return;
    }

    if (button.dataset.enterprisePrintReceipt === 'true') {
      event.preventDefault();
      printReceipt();
      return;
    }

    if (button.closest('.pos-recent-transactions-bottom') && text === 'export') {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportTransactions();
      notify('Current POS session transactions exported.', 'success');
    }
  }, true);
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

    if (label.includes('pin') || label.includes('code')) input.inputMode = 'numeric';
  });

  installEnterpriseHandlers();
  suppressCommunicationSubmenus(root);
  enhanceModuleHeaders(root);
  enhanceOperationalForms(root);
  enhanceStatusColumns(root);
  ensureCloseReconciliationFields();
  ensureReceiptButton();
  enhanceRecentTransactions();
  void synchronizePosSessionControls();
}

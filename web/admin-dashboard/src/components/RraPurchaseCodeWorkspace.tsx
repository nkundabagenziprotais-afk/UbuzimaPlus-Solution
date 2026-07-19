import { useMemo, useState } from 'react';

const rraPurchaseCodeLink =
  'https://myrra.rra.gov.rw/main/service/indexPurchaseInitiation';

const defaultBuyerPhone = '0788320564';
const defaultBuyerTin = '128815557';

const purchaseReasons = [
  'Core Product Purchase',
  'General Stock Item Purchase',
  'Administrative Expenses',
  'Other Expenses',
] as const;

type PurchaseReason = (typeof purchaseReasons)[number];

type RraPurchaseCodeEntry = {
  id: string;
  createdAt: string;
  sellerTin: string;
  purchaseCode: string;
  reason: PurchaseReason;
};

type Props = {
  token: string;
  profile: unknown;
};

function profileCanManageRraSettings(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') {
    return false;
  }

  const record = profile as Record<string, unknown>;

  const permissions = Array.isArray(record.permissions)
    ? record.permissions.map((permission) => String(permission))
    : [];

  const roles = Array.isArray(record.roles)
    ? record.roles.map((role) => String(role).toLowerCase())
    : [];

  const roleNames = Array.isArray(record.role_names)
    ? record.role_names.map((role) => String(role).toLowerCase())
    : [];

  return permissions.some((permission) =>
    [
      'tenant.admin',
      'platform.admin',
      'procurement.manage',
      'procurement.settings.manage',
      'roles.manage',
      'tenant.roles.manage',
    ].includes(permission),
  )
    || roles.some((role) =>
      ['admin', 'owner', 'administrator', 'super admin'].includes(role),
    )
    || roleNames.some((role) =>
      ['admin', 'owner', 'administrator', 'super admin'].includes(role),
    );
}

function readStoredValue(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function readHistory(): RraPurchaseCodeEntry[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem('ubuzima.rraPurchaseCode.history.v1') || '[]',
    );

    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: RraPurchaseCodeEntry[]): void {
  try {
    localStorage.setItem(
      'ubuzima.rraPurchaseCode.history.v1',
      JSON.stringify(entries.slice(0, 50)),
    );
  } catch {
    // Local storage is optional.
  }
}

function formatDateTime(value: string): { date: string; time: string } {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: '—', time: '—' };
  }

  return {
    date: date.toLocaleDateString('en-RW'),
    time: date.toLocaleTimeString('en-RW', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function RraPurchaseCodeWorkspace({ profile }: Props) {
  const canManageDefaults = profileCanManageRraSettings(profile);

  const [buyerPhone, setBuyerPhone] = useState(() =>
    readStoredValue('ubuzima.rraPurchaseCode.buyerPhone', defaultBuyerPhone),
  );
  const [buyerTin, setBuyerTin] = useState(() =>
    readStoredValue('ubuzima.rraPurchaseCode.buyerTin', defaultBuyerTin),
  );
  const [sellerTin, setSellerTin] = useState('');
  const [reason, setReason] = useState<PurchaseReason>(
    'Core Product Purchase',
  );
  const [purchaseCode, setPurchaseCode] = useState('');
  const [smsText, setSmsText] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<RraPurchaseCodeEntry[]>(readHistory);

  const canSave = useMemo(
    () => sellerTin.trim().length >= 9 && purchaseCode.trim().length >= 4,
    [sellerTin, purchaseCode],
  );

  function saveBuyerDefaults(): void {
    if (!canManageDefaults) {
      setNotice('Only Admin or Owner users can update buyer defaults.');
      return;
    }

    localStorage.setItem('ubuzima.rraPurchaseCode.buyerPhone', buyerPhone);
    localStorage.setItem('ubuzima.rraPurchaseCode.buyerTin', buyerTin);
    setNotice('Buyer defaults saved for this browser.');
  }

  function openRraPurchaseInitiation(): void {
    if (!sellerTin.trim()) {
      setNotice('Enter the Seller TIN before opening RRA purchase initiation.');
      return;
    }

    window.open(rraPurchaseCodeLink, '_blank', 'noopener,noreferrer');
    setNotice(
      'RRA purchase initiation opened. Use the Buyer Phone and Buyer TIN shown here, then paste or enter the SMS purchase code after it arrives.',
    );
  }

  function extractPurchaseCodeFromSms(): void {
    const codeMatch = smsText.match(/purchase code is:\s*(\d+)/i);
    const sellerTinMatch = smsText.match(/seller TIN:\s*(\d+)/i);

    if (codeMatch?.[1]) {
      setPurchaseCode(codeMatch[1]);
    }

    if (sellerTinMatch?.[1]) {
      setSellerTin(sellerTinMatch[1]);
    }

    if (!codeMatch?.[1]) {
      setNotice('No purchase code was found in the pasted SMS text.');
      return;
    }

    setNotice('Purchase code extracted from pasted RRA SMS text.');
  }

  function saveEntry(): void {
    if (!canSave) {
      setNotice('Enter Seller TIN and Purchase Code before saving.');
      return;
    }

    const entry: RraPurchaseCodeEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      sellerTin: sellerTin.trim(),
      purchaseCode: purchaseCode.trim(),
      reason,
    };

    const nextHistory = [entry, ...history].slice(0, 50);
    setHistory(nextHistory);
    saveHistory(nextHistory);
    setPurchaseCode('');
    setSmsText('');
    setNotice('Purchase code saved to the local procurement history.');
  }

  return (
    <section className="rra-purchase-code-workspace">
      <div className="section-heading">
        <div>
          <span>Procurement compliance</span>
          <h2>RRA Purchase Code Generator</h2>
          <p>
            Prepare the buyer details, enter the Seller TIN, open the RRA
            purchase initiation service, then capture the received purchase
            code for procurement records.
          </p>
        </div>
      </div>

      <div className="rra-purchase-code-grid">
        <article className="rra-purchase-code-card">
          <span>Buyer Phone</span>
          <strong>{buyerPhone}</strong>
        </article>

        <article className="rra-purchase-code-card">
          <span>Buyer TIN</span>
          <strong>{buyerTin}</strong>
        </article>

        <article className="rra-purchase-code-card rra-purchase-code-card--input">
          <label>
            <span>Seller TIN</span>
            <input
              value={sellerTin}
              onChange={(event) =>
                setSellerTin(event.target.value.replace(/\D/g, ''))
              }
              inputMode="numeric"
              placeholder="Enter seller TIN"
            />
          </label>
        </article>

        <article className="rra-purchase-code-card rra-purchase-code-card--input">
          <label>
            <span>Reason for Purchase Code</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as PurchaseReason)}
            >
              {purchaseReasons.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </article>

        <article className="rra-purchase-code-card rra-purchase-code-card--action">
          <span>Get Purchase Code</span>
          <button type="button" onClick={openRraPurchaseInitiation}>
            Open RRA
          </button>
        </article>
      </div>

      <section className="rra-purchase-code-capture">
        <div className="rra-purchase-code-capture__panel">
          <h3>Capture received purchase code</h3>

          <label>
            <span>Purchase Code</span>
            <input
              value={purchaseCode}
              onChange={(event) =>
                setPurchaseCode(event.target.value.replace(/\D/g, ''))
              }
              inputMode="numeric"
              placeholder="Example: 788111"
            />
          </label>

          <label>
            <span>Paste RRA SMS text</span>
            <textarea
              value={smsText}
              onChange={(event) => setSmsText(event.target.value)}
              rows={4}
              placeholder="Dear Taxpayer, your OTP purchase code is: 788111 and is valid on this seller TIN: 103657371"
            />
          </label>

          <div className="rra-purchase-code-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={extractPurchaseCodeFromSms}
            >
              Extract Code from SMS
            </button>
            <button type="button" onClick={saveEntry} disabled={!canSave}>
              Save Purchase Code
            </button>
          </div>

          {notice ? (
            <p className="notice" role="status" aria-live="polite">
              {notice}
            </p>
          ) : null}
        </div>

        <div className="rra-purchase-code-capture__panel rra-purchase-code-settings">
          <h3>Buyer default settings</h3>
          <p>
            Default buyer details are prefilled for daily procurement. Admin or
            Owner users can update them when the registered buyer changes.
          </p>

          <label>
            <span>Authorized Buyer Phone</span>
            <input
              value={buyerPhone}
              onChange={(event) =>
                setBuyerPhone(event.target.value.replace(/[^\d+]/g, ''))
              }
              disabled={!canManageDefaults}
            />
          </label>

          <label>
            <span>Buyer TIN Number</span>
            <input
              value={buyerTin}
              onChange={(event) =>
                setBuyerTin(event.target.value.replace(/\D/g, ''))
              }
              disabled={!canManageDefaults}
            />
          </label>

          <button
            type="button"
            className="secondary-action"
            onClick={saveBuyerDefaults}
            disabled={!canManageDefaults}
          >
            Save Buyer Defaults
          </button>

          {!canManageDefaults ? (
            <small>Only Admin or Owner users can change buyer defaults.</small>
          ) : null}
        </div>
      </section>

      <section className="rra-purchase-code-history">
        <div className="section-heading">
          <div>
            <span>Purchase code records</span>
            <h3>Recent RRA Purchase Codes</h3>
          </div>
        </div>

        <div className="system-table-wrap">
          <table className="system-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Seller TIN</th>
                <th>Purchase Code</th>
                <th>Reason for Purchase Code</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    No purchase codes have been captured yet.
                  </td>
                </tr>
              ) : (
                history.map((entry) => {
                  const dateTime = formatDateTime(entry.createdAt);

                  return (
                    <tr key={entry.id}>
                      <td>{dateTime.date}</td>
                      <td>{dateTime.time}</td>
                      <td>{entry.sellerTin}</td>
                      <td>{entry.purchaseCode}</td>
                      <td>{entry.reason}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

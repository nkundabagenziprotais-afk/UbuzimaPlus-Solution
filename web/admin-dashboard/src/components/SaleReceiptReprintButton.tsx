import {
  useMemo,
  useState,
} from 'react';

import {
  type PharmaSale,
} from '../lib/api';

import {
  printThermalElement,
} from '../lib/thermalPrint';

type SaleReceiptReprintButtonProps = {
  sale: PharmaSale;
  label?: string;
};

function amount(value: unknown): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

export function SaleReceiptReprintButton({
  sale,
  label = 'Reprint Receipt',
}: SaleReceiptReprintButtonProps) {
  const [notice, setNotice] = useState('');

  const payment = useMemo(
    () =>
      (sale.payments ?? []).find(
        (candidate) =>
          Boolean(candidate.receipt_number),
      )
      ?? sale.payments?.[0]
      ?? null,
    [sale],
  );

  const lines = useMemo(
    () =>
      (sale.items ?? [])
        .map((item) => ({
          id: item.id,
          name:
            item.product_name_snapshot
            || item.product?.name
            || 'Unnamed product',
          quantity: amount(item.quantity),
          unitPrice: amount(item.unit_price),
          total: amount(
            item.line_total
            || amount(item.quantity)
              * amount(item.unit_price),
          ),
        }))
        .filter((line) => line.quantity > 0),
    [sale],
  );

  const receiptId =
    `sale-reprint-receipt-${sale.id}`;

  const canPrint =
    Boolean(payment?.receipt_number)
    && lines.length > 0;

  async function handleReprint() {
    if (!payment?.receipt_number) {
      setNotice(
        'This transaction has no generated receipt number.',
      );
      return;
    }

    if (lines.length === 0) {
      setNotice(
        'Product details are unavailable for this transaction.',
      );
      return;
    }

    setNotice('');

    try {
      await printThermalElement(
        receiptId,
        {
          documentTitle:
            payment.receipt_number,
          paperWidthMm: 80,
        },
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'The receipt could not be printed.',
      );
    }
  }

  return (
    <div className="sale-receipt-reprint-control">
      <button
        type="button"
        className="secondary-action"
        onClick={() => void handleReprint()}
        disabled={!canPrint}
        title={
          canPrint
            ? 'Print the persisted customer receipt'
            : 'Receipt or product details unavailable'
        }
      >
        {label}
      </button>

      {notice && (
        <small className="form-error">
          {notice}
        </small>
      )}

      <section
        id={receiptId}
        className="pos-thermal-receipt-source"
        aria-hidden="true"
      >
        <header className="pos-thermal-receipt__header">
          <strong>Customer receipt</strong>
          <span>Ubuzima+</span>
          <small>Reprinted completed-sale record</small>
        </header>

        <div className="pos-thermal-receipt__meta">
          <div>
            <span>Receipt</span>
            <strong>
              {payment?.receipt_number ?? '—'}
            </strong>
          </div>

          <div>
            <span>Sale</span>
            <strong>{sale.sale_number}</strong>
          </div>

          <div>
            <span>Business date</span>
            <strong>
              {sale.business_date ?? '—'}
            </strong>
          </div>

          <div>
            <span>Customer</span>
            <strong>
              {sale.customer?.full_name
                ?? 'Walk-in customer'}
            </strong>
          </div>

          <div>
            <span>Payment</span>
            <strong>
              {String(
                payment?.payment_method ?? '—',
              ).replaceAll('_', ' ')}
            </strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            {lines.map((line) => (
              <tr
                key={line.id}
                data-pos-receipt-line="true"
              >
                <td>
                  {line.name}
                  <small>
                    RWF{' '}
                    {line.unitPrice.toLocaleString(
                      'en-RW',
                    )}
                  </small>
                </td>

                <td>
                  {line.quantity.toLocaleString(
                    'en-RW',
                    {
                      maximumFractionDigits: 4,
                    },
                  )}
                </td>

                <td>
                  RWF{' '}
                  {line.total.toLocaleString(
                    'en-RW',
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pos-thermal-receipt__totals">
          <div className="pos-thermal-receipt__total-row">
            <span>Subtotal</span>
            <strong>
              RWF{' '}
              {amount(
                sale.subtotal_amount,
              ).toLocaleString('en-RW')}
            </strong>
          </div>

          <div className="pos-thermal-receipt__total-row">
            <span>Discount</span>
            <strong>
              RWF{' '}
              {amount(
                sale.discount_amount,
              ).toLocaleString('en-RW')}
            </strong>
          </div>

          <div className="pos-thermal-receipt__total-row pos-thermal-receipt__total-row--grand">
            <span>Total</span>
            <strong>
              RWF{' '}
              {amount(
                sale.total_amount,
              ).toLocaleString('en-RW')}
            </strong>
          </div>

          <div className="pos-thermal-receipt__total-row">
            <span>Paid</span>
            <strong>
              RWF{' '}
              {amount(
                sale.paid_amount,
              ).toLocaleString('en-RW')}
            </strong>
          </div>

          <div className="pos-thermal-receipt__total-row">
            <span>Balance</span>
            <strong>
              RWF{' '}
              {amount(
                sale.balance_amount,
              ).toLocaleString('en-RW')}
            </strong>
          </div>
        </div>

        <footer className="pos-thermal-receipt__footer">
          <strong>Receipt reprint</strong>
          <small>
            This copy reflects the persisted completed sale.
          </small>
        </footer>
      </section>
    </div>
  );
}

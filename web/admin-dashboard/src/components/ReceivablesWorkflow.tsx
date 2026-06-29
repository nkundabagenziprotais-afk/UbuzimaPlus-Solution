import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createPharmaReceivable,
  getPharmaReceivable,
  getPharmaReceivableCustomers,
  getPharmaReceivables,
  recordPharmaReceivablePayment,
  updatePharmaCustomerCredit,
  type PharmaReceivable,
  type PharmaReceivableCustomer,
} from '../lib/api';

type ReceivablesWorkflowProps = {
  token: string;
  profile?: {
    tenant?: {
      name?: string;
      slug?: string;
    };
  } | null;
};

type CreditForm = {
  customerId: string;
  creditLimit: string;
  creditTermsDays: string;
  creditStatus: 'enabled' | 'disabled' | 'suspended';
};

type ReceivableForm = {
  customerId: string;
  amount: string;
  dueDate: string;
  notes: string;
};

type PaymentForm = {
  amount: string;
  paymentMethod: 'cash' | 'momo' | 'card' | 'bank_transfer' | 'cheque';
  referenceNumber: string;
  notes: string;
};

const money = new Intl.NumberFormat('en-RW', {
  style: 'currency',
  currency: 'RWF',
  maximumFractionDigits: 0,
});

const formatMoney = (value?: number | null) => money.format(Number(value || 0));

const formatDate = (value?: string | null) => {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const todayPlusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
};

const customerName = (customer?: PharmaReceivableCustomer | null) => {
  if (!customer) return 'Unknown customer';
  if (customer.name) return customer.name;

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();

  return fullName || customer.customer_code || `Customer #${customer.id}`;
};

const readableStatus = (value?: string) => {
  return (value || 'unknown').replaceAll('_', ' ');
};

const isOverdue = (receivable: PharmaReceivable) => {
  if (!receivable.due_date || Number(receivable.balance_amount || 0) <= 0) {
    return false;
  }

  const due = new Date(receivable.due_date);
  const today = new Date();

  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return due < today;
};

export default function ReceivablesWorkflow({ token, profile }: ReceivablesWorkflowProps) {
  const [customers, setCustomers] = useState<PharmaReceivableCustomer[]>([]);
  const [receivables, setReceivables] = useState<PharmaReceivable[]>([]);
  const [selectedReceivable, setSelectedReceivable] = useState<PharmaReceivable | null>(null);

  const [creditForm, setCreditForm] = useState<CreditForm>({
    customerId: '',
    creditLimit: '',
    creditTermsDays: '30',
    creditStatus: 'enabled',
  });

  const [receivableForm, setReceivableForm] = useState<ReceivableForm>({
    customerId: '',
    amount: '',
    dueDate: todayPlusDays(30),
    notes: '',
  });

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    amount: '',
    paymentMethod: 'momo',
    referenceNumber: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const tenantName = profile?.tenant?.name || 'VitaPharma Africa';

  const summary = useMemo(() => {
    return receivables.reduce(
      (total, receivable) => {
        const balance = Number(receivable.balance_amount || 0);

        total.openBalance += balance;

        if (balance > 0) {
          total.openCount += 1;
        }

        if (isOverdue(receivable)) {
          total.overdueBalance += balance;
          total.overdueCount += 1;
        }

        if (receivable.status === 'collected') {
          total.collectedCount += 1;
        }

        return total;
      },
      {
        openBalance: 0,
        overdueBalance: 0,
        openCount: 0,
        overdueCount: 0,
        collectedCount: 0,
      },
    );
  }, [receivables]);

  const creditCustomers = useMemo(() => {
    return customers.filter((customer) => customer.credit_status === 'enabled');
  }, [customers]);

  const loadWorkspace = async () => {
    setLoading(true);
    setError('');

    try {
      const [receivablesResponse, customersResponse] = await Promise.all([
        getPharmaReceivables(token),
        getPharmaReceivableCustomers(token),
      ]);

      const nextReceivables = receivablesResponse.receivables || [];
      const nextCustomers = customersResponse.customers || [];

      setReceivables(nextReceivables);
      setCustomers(nextCustomers);

      if (!creditForm.customerId && nextCustomers[0]) {
        const customer = nextCustomers[0];

        setCreditForm({
          customerId: String(customer.id),
          creditLimit: String(customer.credit_limit || ''),
          creditTermsDays: String(customer.credit_terms_days || 30),
          creditStatus: (customer.credit_status as CreditForm['creditStatus']) || 'enabled',
        });

        setReceivableForm((current) => ({
          ...current,
          customerId: String(customer.id),
        }));
      }

      if (!selectedReceivable && nextReceivables[0]) {
        setSelectedReceivable(nextReceivables[0]);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load receivables.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void loadWorkspace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selectCreditCustomer = (customerId: string) => {
    const customer = customers.find((item) => String(item.id) === customerId);

    setCreditForm({
      customerId,
      creditLimit: String(customer?.credit_limit || ''),
      creditTermsDays: String(customer?.credit_terms_days || 30),
      creditStatus: (customer?.credit_status as CreditForm['creditStatus']) || 'enabled',
    });
  };

  const openReceivable = async (receivableId: number) => {
    setError('');

    try {
      const response = await getPharmaReceivable(token, receivableId);

      setSelectedReceivable(response.receivable);
      setPaymentForm((current) => ({
        ...current,
        amount:
          Number(response.receivable.balance_amount || 0) > 0
            ? String(response.receivable.balance_amount)
            : current.amount,
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to open receivable.');
    }
  };

  const submitCredit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!creditForm.customerId) {
      setError('Select a customer first.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await updatePharmaCustomerCredit(token, Number(creditForm.customerId), {
        credit_limit: Number(creditForm.creditLimit || 0),
        credit_terms_days: creditForm.creditTermsDays ? Number(creditForm.creditTermsDays) : null,
        credit_status: creditForm.creditStatus,
      });

      setNotice(response.message || 'Customer credit updated.');
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update customer credit.');
    } finally {
      setSaving(false);
    }
  };

  const submitReceivable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!receivableForm.customerId) {
      setError('Select a customer first.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await createPharmaReceivable(token, {
        pharmaco_customer_id: Number(receivableForm.customerId),
        amount: Number(receivableForm.amount || 0),
        due_date: receivableForm.dueDate || null,
        notes: receivableForm.notes || null,
      });

      setNotice(response.message || 'Receivable created.');
      setReceivableForm((current) => ({
        ...current,
        amount: '',
        notes: '',
      }));
      await loadWorkspace();
      await openReceivable(response.receivable.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create receivable.');
    } finally {
      setSaving(false);
    }
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedReceivable) {
      setError('Select a receivable first.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await recordPharmaReceivablePayment(token, selectedReceivable.id, {
        amount: Number(paymentForm.amount || 0),
        payment_method: paymentForm.paymentMethod,
        reference_number: paymentForm.referenceNumber || null,
        notes: paymentForm.notes || null,
      });

      setNotice(response.message || 'Payment recorded.');
      setSelectedReceivable(response.receivable);
      setPaymentForm({
        amount: '',
        paymentMethod: 'momo',
        referenceNumber: '',
        notes: '',
      });
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="receivables-workflow" aria-labelledby="receivables-title">
      <div className="receivables-section-header">
        <div>
          <p className="section-kicker">PharmaCo360 finance</p>
          <h2 id="receivables-title">Customer Credit & Receivables</h2>
          <p>
            Track customer credit exposure, overdue balances, and collections for {tenantName}.
          </p>
        </div>

        <button type="button" className="secondary-button" onClick={loadWorkspace} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {notice && <div className="receivables-message success">{notice}</div>}
      {error && <div className="receivables-message error">{error}</div>}

      <div className="receivables-kpis">
        <article>
          <span>Open balance</span>
          <strong>{formatMoney(summary.openBalance)}</strong>
          <small>{summary.openCount} open receivables</small>
        </article>
        <article>
          <span>Overdue balance</span>
          <strong>{formatMoney(summary.overdueBalance)}</strong>
          <small>{summary.overdueCount} overdue</small>
        </article>
        <article>
          <span>Customers on credit</span>
          <strong>{creditCustomers.length}</strong>
          <small>Enabled credit profiles</small>
        </article>
        <article>
          <span>Collected accounts</span>
          <strong>{summary.collectedCount}</strong>
          <small>Fully settled</small>
        </article>
      </div>

      <div className="receivables-grid">
        <form className="receivables-card receivables-form" onSubmit={submitCredit}>
          <h3>Customer credit</h3>
          <p>Set a customer credit limit before allowing receivables.</p>

          <label>
            Customer
            <select value={creditForm.customerId} onChange={(event) => selectCreditCustomer(event.target.value)}>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customerName(customer)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Credit limit
            <input
              type="number"
              min="0"
              value={creditForm.creditLimit}
              onChange={(event) =>
                setCreditForm((current) => ({ ...current, creditLimit: event.target.value }))
              }
            />
          </label>

          <label>
            Terms days
            <input
              type="number"
              min="0"
              max="365"
              value={creditForm.creditTermsDays}
              onChange={(event) =>
                setCreditForm((current) => ({ ...current, creditTermsDays: event.target.value }))
              }
            />
          </label>

          <label>
            Credit status
            <select
              value={creditForm.creditStatus}
              onChange={(event) =>
                setCreditForm((current) => ({
                  ...current,
                  creditStatus: event.target.value as CreditForm['creditStatus'],
                }))
              }
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>

          <button type="submit" className="primary-button" disabled={saving}>
            Update customer credit
          </button>
        </form>

        <form className="receivables-card receivables-form" onSubmit={submitReceivable}>
          <h3>Create receivable</h3>
          <p>Record a customer credit balance with a clear due date.</p>

          <label>
            Customer
            <select
              value={receivableForm.customerId}
              onChange={(event) =>
                setReceivableForm((current) => ({ ...current, customerId: event.target.value }))
              }
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customerName(customer)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Amount
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={receivableForm.amount}
              onChange={(event) =>
                setReceivableForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
          </label>

          <label>
            Due date
            <input
              type="date"
              value={receivableForm.dueDate}
              onChange={(event) =>
                setReceivableForm((current) => ({ ...current, dueDate: event.target.value }))
              }
            />
          </label>

          <label>
            Note
            <textarea
              value={receivableForm.notes}
              onChange={(event) =>
                setReceivableForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>

          <button type="submit" className="primary-button" disabled={saving}>
            Create receivable
          </button>
        </form>
      </div>

      <div className="receivables-grid main">
        <div className="receivables-card">
          <h3>Receivables register</h3>

          <div className="receivables-table-wrap">
            <table className="receivables-table">
              <thead>
                <tr>
                  <th>Receivable</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((receivable) => (
                  <tr key={receivable.id} className={isOverdue(receivable) ? 'is-overdue' : ''}>
                    <td>{receivable.receivable_number}</td>
                    <td>{customerName(receivable.customer)}</td>
                    <td>{readableStatus(receivable.status)}</td>
                    <td>{formatMoney(receivable.balance_amount)}</td>
                    <td>{formatDate(receivable.due_date)}</td>
                    <td>
                      <button type="button" className="link-button" onClick={() => openReceivable(receivable.id)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}

                {!receivables.length && (
                  <tr>
                    <td colSpan={6}>No receivables recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form className="receivables-card receivables-form" onSubmit={submitPayment}>
          <h3>Collection</h3>

          {selectedReceivable ? (
            <>
              <div className="receivable-selected">
                <span>{selectedReceivable.receivable_number}</span>
                <strong>{formatMoney(selectedReceivable.balance_amount)}</strong>
                <small>{customerName(selectedReceivable.customer)}</small>
              </div>

              <label>
                Amount collected
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, amount: event.target.value }))
                  }
                />
              </label>

              <label>
                Payment method
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      paymentMethod: event.target.value as PaymentForm['paymentMethod'],
                    }))
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="momo">Mobile money</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </label>

              <label>
                Reference
                <input
                  value={paymentForm.referenceNumber}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, referenceNumber: event.target.value }))
                  }
                />
              </label>

              <label>
                Note
                <textarea
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </label>

              <button
                type="submit"
                className="primary-button"
                disabled={saving || Number(selectedReceivable.balance_amount || 0) <= 0}
              >
                Record payment
              </button>
            </>
          ) : (
            <p>Select a receivable to record payment.</p>
          )}
        </form>
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import {
  PharmaBranch,
  PharmaCustomer,
  PharmaPrescription,
  PharmaProduct,
  PharmaSale,
  createPharmaCustomer,
  createPharmaPrescription,
  createPharmaSale,
} from '../lib/api';

type Props = {
  token: string;
  tenantSlug: string;
  branches: PharmaBranch[];
  customers: PharmaCustomer[];
  prescriptions: PharmaPrescription[];
  products: PharmaProduct[];
  onCustomerCreated: (customer: PharmaCustomer) => void;
  onPrescriptionCreated: (prescription: PharmaPrescription) => void;
  onSaleCreated: (sale: PharmaSale) => void;
};

type CustomerForm = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  gender: string;
  insurance_provider: string;
  insurance_membership_number: string;
  notes: string;
};

type PrescriptionForm = {
  pharmaco_customer_id: string;
  prescriber_name: string;
  prescriber_facility: string;
  prescriber_phone: string;
  issued_at: string;
  expires_at: string;
  notes: string;
};

type SaleLineForm = {
  product_id: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  tax_amount: string;
};

type SaleForm = {
  branch_id: string;
  pharmaco_customer_id: string;
  pharmaco_prescription_id: string;
  sale_type: 'cash_sale' | 'prescription_sale' | 'insurance_sale' | 'credit_sale';
  discount_amount: string;
  tax_amount: string;
  notes: string;
  items: SaleLineForm[];
};

function blankCustomerForm(): CustomerForm {
  return {
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    gender: '',
    insurance_provider: '',
    insurance_membership_number: '',
    notes: '',
  };
}

function blankPrescriptionForm(customerId = ''): PrescriptionForm {
  return {
    pharmaco_customer_id: customerId,
    prescriber_name: '',
    prescriber_facility: '',
    prescriber_phone: '',
    issued_at: new Date().toISOString().slice(0, 10),
    expires_at: '',
    notes: '',
  };
}

function blankSaleLine(productId = ''): SaleLineForm {
  return {
    product_id: productId,
    quantity: '1',
    unit_price: '',
    discount_amount: '0',
    tax_amount: '0',
  };
}

function blankSaleForm(branchId = '', customerId = '', prescriptionId = ''): SaleForm {
  return {
    branch_id: branchId,
    pharmaco_customer_id: customerId,
    pharmaco_prescription_id: prescriptionId,
    sale_type: prescriptionId ? 'prescription_sale' : 'cash_sale',
    discount_amount: '0',
    tax_amount: '0',
    notes: '',
    items: [blankSaleLine()],
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value);
}

export function SalesCreationPanel({
  token,
  tenantSlug,
  branches,
  customers,
  prescriptions,
  products,
  onCustomerCreated,
  onPrescriptionCreated,
  onSaleCreated,
}: Props) {
  const activeBranches = branches.filter((branch) => branch.status === 'active');
  const activeProducts = products.filter((product) => product.status === 'active');

  const [customerForm, setCustomerForm] = useState<CustomerForm>(blankCustomerForm());
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionForm>(blankPrescriptionForm());
  const [saleForm, setSaleForm] = useState<SaleForm>(
    blankSaleForm(String(activeBranches[0]?.id ?? ''), '', ''),
  );
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);
  const [isSavingSale, setIsSavingSale] = useState(false);
  const [creationNotice, setCreationNotice] = useState('');
  const [creationError, setCreationError] = useState('');

  const salePreview = useMemo(() => {
    const lineSubtotal = saleForm.items.reduce((sum, item) => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unit_price);
      const discount = toNumber(item.discount_amount);
      const tax = toNumber(item.tax_amount);

      return sum + Math.max(quantity * unitPrice - discount + tax, 0);
    }, 0);

    const saleDiscount = toNumber(saleForm.discount_amount);
    const saleTax = toNumber(saleForm.tax_amount);
    const total = Math.max(lineSubtotal - saleDiscount + saleTax, 0);

    return {
      lineSubtotal,
      total,
    };
  }, [saleForm]);

  const prescriptionRequiredWithoutPrescription = saleForm.items.some((item) => {
    const product = activeProducts.find((entry) => entry.id === Number(item.product_id));

    return product?.requires_prescription && !saleForm.pharmaco_prescription_id;
  });

  async function handleCreateCustomer() {
    if (!customerForm.first_name.trim()) {
      setCreationError('Customer first name is required.');
      return;
    }

    setIsSavingCustomer(true);
    setCreationError('');
    setCreationNotice('');

    try {
      const response = await createPharmaCustomer(token, tenantSlug, {
        first_name: customerForm.first_name.trim(),
        last_name: customerForm.last_name.trim() || null,
        phone: customerForm.phone.trim() || null,
        email: customerForm.email.trim() || null,
        gender: customerForm.gender.trim() || null,
        insurance_provider: customerForm.insurance_provider.trim() || null,
        insurance_membership_number: customerForm.insurance_membership_number.trim() || null,
        customer_type: 'patient',
        notes: customerForm.notes.trim() || null,
      });

      onCustomerCreated(response.customer);
      setCustomerForm(blankCustomerForm());
      setPrescriptionForm(blankPrescriptionForm(String(response.customer.id)));
      setSaleForm((current) => ({
        ...current,
        pharmaco_customer_id: String(response.customer.id),
      }));
      setCreationNotice(response.message);
    } catch (err) {
      setCreationError(err instanceof Error ? err.message : 'Unable to create customer.');
    } finally {
      setIsSavingCustomer(false);
    }
  }

  async function handleCreatePrescription() {
    setIsSavingPrescription(true);
    setCreationError('');
    setCreationNotice('');

    try {
      const response = await createPharmaPrescription(token, tenantSlug, {
        pharmaco_customer_id: prescriptionForm.pharmaco_customer_id
          ? Number(prescriptionForm.pharmaco_customer_id)
          : null,
        prescriber_name: prescriptionForm.prescriber_name.trim() || null,
        prescriber_facility: prescriptionForm.prescriber_facility.trim() || null,
        prescriber_phone: prescriptionForm.prescriber_phone.trim() || null,
        issued_at: prescriptionForm.issued_at || null,
        expires_at: prescriptionForm.expires_at || null,
        notes: prescriptionForm.notes.trim() || null,
      });

      onPrescriptionCreated(response.prescription);
      setPrescriptionForm(blankPrescriptionForm(prescriptionForm.pharmaco_customer_id));
      setSaleForm((current) => ({
        ...current,
        pharmaco_customer_id: String(response.prescription.customer?.id ?? current.pharmaco_customer_id),
        pharmaco_prescription_id: String(response.prescription.id),
        sale_type: 'prescription_sale',
      }));
      setCreationNotice(response.message);
    } catch (err) {
      setCreationError(err instanceof Error ? err.message : 'Unable to create prescription.');
    } finally {
      setIsSavingPrescription(false);
    }
  }

  async function handleCreateSale() {
    if (!saleForm.branch_id) {
      setCreationError('Select a branch before creating the sale.');
      return;
    }

    const validItems = saleForm.items
      .filter((item) => item.product_id && toNumber(item.quantity) > 0 && toNumber(item.unit_price) >= 0)
      .map((item) => ({
        product_id: Number(item.product_id),
        quantity: toNumber(item.quantity),
        unit_price: toNumber(item.unit_price),
        discount_amount: toNumber(item.discount_amount),
        tax_amount: toNumber(item.tax_amount),
      }));

    if (validItems.length === 0) {
      setCreationError('Add at least one valid sale item.');
      return;
    }

    if (prescriptionRequiredWithoutPrescription) {
      setCreationError('A prescription is required for one or more selected products.');
      return;
    }

    setIsSavingSale(true);
    setCreationError('');
    setCreationNotice('');

    try {
      const response = await createPharmaSale(token, tenantSlug, {
        branch_id: Number(saleForm.branch_id),
        pharmaco_customer_id: saleForm.pharmaco_customer_id
          ? Number(saleForm.pharmaco_customer_id)
          : null,
        pharmaco_prescription_id: saleForm.pharmaco_prescription_id
          ? Number(saleForm.pharmaco_prescription_id)
          : null,
        sale_type: saleForm.sale_type,
        discount_amount: toNumber(saleForm.discount_amount),
        tax_amount: toNumber(saleForm.tax_amount),
        notes: saleForm.notes.trim() || null,
        items: validItems,
      });

      onSaleCreated(response.sale);
      setSaleForm(blankSaleForm(saleForm.branch_id, saleForm.pharmaco_customer_id, saleForm.pharmaco_prescription_id));
      setCreationNotice(response.message);
    } catch (err) {
      setCreationError(err instanceof Error ? err.message : 'Unable to create draft sale.');
    } finally {
      setIsSavingSale(false);
    }
  }

  function updateSaleLine(index: number, patch: Partial<SaleLineForm>) {
    setSaleForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeSaleLine(index: number) {
    setSaleForm((current) => ({
      ...current,
      items: current.items.length === 1
        ? current.items
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  return (
    <section className="sales-creation-card">
      <div className="panel-heading-row">
        <div>
          <span className="section-label">Create workflow</span>
          <h3>Customer → prescription → draft sale</h3>
          <p className="muted">
            Start a pharmacy transaction before controlled dispensing and payment recording.
          </p>
        </div>
        <div className="sale-total-box">
          <span>Draft preview</span>
          <strong>{money(salePreview.total)}</strong>
          <small>Line subtotal: {money(salePreview.lineSubtotal)}</small>
        </div>
      </div>

      {creationError && <div className="form-error">{creationError}</div>}
      {creationNotice && <div className="form-success">{creationNotice}</div>}

      <div className="creation-workflow-grid">
        <section>
          <h4>1. New customer</h4>
          <div className="creation-form-grid">
            <label>
              First name
              <input
                value={customerForm.first_name}
                onChange={(event) => setCustomerForm((current) => ({ ...current, first_name: event.target.value }))}
              />
            </label>
            <label>
              Last name
              <input
                value={customerForm.last_name}
                onChange={(event) => setCustomerForm((current) => ({ ...current, last_name: event.target.value }))}
              />
            </label>
            <label>
              Phone
              <input
                value={customerForm.phone}
                onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={customerForm.email}
                onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label>
              Gender
              <input
                value={customerForm.gender}
                onChange={(event) => setCustomerForm((current) => ({ ...current, gender: event.target.value }))}
              />
            </label>
            <label>
              Insurer
              <input
                value={customerForm.insurance_provider}
                onChange={(event) => setCustomerForm((current) => ({ ...current, insurance_provider: event.target.value }))}
              />
            </label>
            <label>
              Insurance number
              <input
                value={customerForm.insurance_membership_number}
                onChange={(event) =>
                  setCustomerForm((current) => ({
                    ...current,
                    insurance_membership_number: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <button type="button" onClick={handleCreateCustomer} disabled={isSavingCustomer}>
            {isSavingCustomer ? 'Creating customer…' : 'Create customer'}
          </button>
        </section>

        <section>
          <h4>2. New prescription</h4>
          <div className="creation-form-grid">
            <label>
              Customer
              <select
                value={prescriptionForm.pharmaco_customer_id}
                onChange={(event) =>
                  setPrescriptionForm((current) => ({
                    ...current,
                    pharmaco_customer_id: event.target.value,
                  }))
                }
              >
                <option value="">Walk-in / no customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prescriber
              <input
                value={prescriptionForm.prescriber_name}
                onChange={(event) =>
                  setPrescriptionForm((current) => ({ ...current, prescriber_name: event.target.value }))
                }
              />
            </label>
            <label>
              Facility
              <input
                value={prescriptionForm.prescriber_facility}
                onChange={(event) =>
                  setPrescriptionForm((current) => ({ ...current, prescriber_facility: event.target.value }))
                }
              />
            </label>
            <label>
              Prescriber phone
              <input
                value={prescriptionForm.prescriber_phone}
                onChange={(event) =>
                  setPrescriptionForm((current) => ({ ...current, prescriber_phone: event.target.value }))
                }
              />
            </label>
            <label>
              Issued at
              <input
                type="date"
                value={prescriptionForm.issued_at}
                onChange={(event) =>
                  setPrescriptionForm((current) => ({ ...current, issued_at: event.target.value }))
                }
              />
            </label>
            <label>
              Expires at
              <input
                type="date"
                value={prescriptionForm.expires_at}
                onChange={(event) =>
                  setPrescriptionForm((current) => ({ ...current, expires_at: event.target.value }))
                }
              />
            </label>
          </div>
          <button type="button" onClick={handleCreatePrescription} disabled={isSavingPrescription}>
            {isSavingPrescription ? 'Creating prescription…' : 'Create prescription'}
          </button>
        </section>
      </div>

      <section className="draft-sale-builder">
        <h4>3. Draft sale</h4>
        <div className="creation-form-grid">
          <label>
            Branch
            <select
              value={saleForm.branch_id}
              onChange={(event) => setSaleForm((current) => ({ ...current, branch_id: event.target.value }))}
            >
              <option value="">Select branch</option>
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Customer
            <select
              value={saleForm.pharmaco_customer_id}
              onChange={(event) => setSaleForm((current) => ({ ...current, pharmaco_customer_id: event.target.value }))}
            >
              <option value="">Walk-in customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Prescription
            <select
              value={saleForm.pharmaco_prescription_id}
              onChange={(event) =>
                setSaleForm((current) => ({
                  ...current,
                  pharmaco_prescription_id: event.target.value,
                  sale_type: event.target.value ? 'prescription_sale' : current.sale_type,
                }))
              }
            >
              <option value="">No prescription</option>
              {prescriptions.map((prescription) => (
                <option key={prescription.id} value={prescription.id}>
                  {prescription.prescription_number}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sale type
            <select
              value={saleForm.sale_type}
              onChange={(event) =>
                setSaleForm((current) => ({
                  ...current,
                  sale_type: event.target.value as SaleForm['sale_type'],
                }))
              }
            >
              <option value="cash_sale">Cash sale</option>
              <option value="prescription_sale">Prescription sale</option>
              <option value="insurance_sale">Insurance sale</option>
              <option value="credit_sale">Credit sale</option>
            </select>
          </label>
        </div>

        <div className="sale-line-builder">
          {saleForm.items.map((item, index) => {
            const product = activeProducts.find((entry) => entry.id === Number(item.product_id));

            return (
              <div key={index} className="sale-line-row">
                <label>
                  Product
                  <select
                    value={item.product_id}
                    onChange={(event) => updateSaleLine(index, { product_id: event.target.value })}
                  >
                    <option value="">Select product</option>
                    {activeProducts.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name} · {entry.sku}{entry.requires_prescription ? ' · RX' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Qty
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={item.quantity}
                    onChange={(event) => updateSaleLine(index, { quantity: event.target.value })}
                  />
                </label>

                <label>
                  Unit price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(event) => updateSaleLine(index, { unit_price: event.target.value })}
                  />
                </label>

                <label>
                  Discount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.discount_amount}
                    onChange={(event) => updateSaleLine(index, { discount_amount: event.target.value })}
                  />
                </label>

                <label>
                  Tax
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.tax_amount}
                    onChange={(event) => updateSaleLine(index, { tax_amount: event.target.value })}
                  />
                </label>

                <div className="line-meta">
                  <span>{product?.requires_prescription ? 'Prescription required' : 'Open sale item'}</span>
                  <button type="button" onClick={() => removeSaleLine(index)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {prescriptionRequiredWithoutPrescription && (
          <div className="form-error">
            One or more selected products require a prescription before the draft sale can be created.
          </div>
        )}

        <div className="draft-sale-footer">
          <button
            type="button"
            onClick={() =>
              setSaleForm((current) => ({
                ...current,
                items: [...current.items, blankSaleLine()],
              }))
            }
          >
            Add line item
          </button>

          <button type="button" onClick={handleCreateSale} disabled={isSavingSale}>
            {isSavingSale ? 'Creating draft sale…' : 'Create draft sale'}
          </button>
        </div>
      </section>
    </section>
  );
}

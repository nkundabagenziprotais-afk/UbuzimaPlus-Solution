import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  InsuranceClaim,
  InsurancePartner,
  InsurancePaymentOption,
  InsuranceReconciliationBatch,
  adjudicateInsuranceClaim,
  createInsuranceClaimPayment,
  createInsuranceReconciliationBatch,
  getInsuranceClaim,
  getInsuranceClaims,
  getInsurancePartners,
  getEligibleInsuranceBatchPayments,
  getInsuranceReconciliationBatches,
  reconcileInsuranceBatch,
  submitInsuranceClaim,
  submitInsuranceReconciliationBatch,
} from '../lib/insuranceApi';

type Props = {
  token: string;
  tenantSlug: string;
  mode: 'claims' | 'reconciliation';
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('en-RW', { maximumFractionDigits: 2 })
    .format(Number(value ?? 0));

const label = (value?: string | null) =>
  (value || 'unknown').replaceAll('_', ' ');

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function InsuranceClaimsReconciliationWorkspace({
  token,
  tenantSlug,
  mode,
}: Props) {
  const [partners, setPartners] = useState<InsurancePartner[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [batches, setBatches] = useState<InsuranceReconciliationBatch[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<InsuranceClaim | null>(null);
  const [selectedBatch, setSelectedBatch] =
    useState<InsuranceReconciliationBatch | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [submissionReference, setSubmissionReference] = useState('');
  const [adjudicationReference, setAdjudicationReference] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] =
    useState(new Date().toISOString().slice(0, 10));

  const [batchPartner, setBatchPartner] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [eligibleClaims, setEligibleClaims] = useState<InsuranceClaim[]>([]);
  const [selectedClaimIds, setSelectedClaimIds] = useState<number[]>([]);
  const [eligiblePayments, setEligiblePayments] =
    useState<InsurancePaymentOption[]>([]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const partnerResponse = await getInsurancePartners(
        token,
        tenantSlug,
        { perPage: 200, status: 'active' },
      );
      setPartners(asArray<InsurancePartner>(partnerResponse.data));

      if (mode === 'claims') {
        const response = await getInsuranceClaims(token, tenantSlug, {
          search: search || undefined,
          status: status || undefined,
          partnerId: partnerId ? Number(partnerId) : undefined,
          perPage: 100,
        });
        setClaims(asArray<InsuranceClaim>(response.data));
      } else {
        const [batchResponse, claimResponse] = await Promise.all([
          getInsuranceReconciliationBatches(
            token,
            tenantSlug,
            {
              status: status || undefined,
              partnerId: partnerId ? Number(partnerId) : undefined,
              perPage: 100,
            },
          ),
          getInsuranceClaims(
            token,
            tenantSlug,
            {
              partnerId: batchPartner
                ? Number(batchPartner)
                : undefined,
              perPage: 200,
            },
          ),
        ]);
        const safeBatches = asArray<InsuranceReconciliationBatch>(
          batchResponse.data,
        );
        const safeClaims = asArray<InsuranceClaim>(claimResponse.data);

        setBatches(safeBatches);
        setEligibleClaims(
          safeClaims.filter(
            (claim) =>
              ['approved', 'partially_approved', 'partially_paid', 'paid']
                .includes(claim.status)
              && (!periodFrom || (claim.service_date || '') >= periodFrom)
              && (!periodTo || (claim.service_date || '') <= periodTo),
          ),
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load data.');
    } finally {
      setBusy(false);
    }
  }, [
    batchPartner,
    mode,
    partnerId,
    periodFrom,
    periodTo,
    search,
    status,
    tenantSlug,
    token,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const safeClaims = asArray<InsuranceClaim>(claims);
  const safeBatches = asArray<InsuranceReconciliationBatch>(batches);

  const claimTotals = useMemo(
    () => safeClaims.reduce(
      (totals, claim) => ({
        claimed: totals.claimed + Number(claim.claimed_amount ?? 0),
        approved: totals.approved + Number(claim.approved_amount ?? 0),
        paid: totals.paid + Number(claim.paid_amount ?? 0),
      }),
      { claimed: 0, approved: 0, paid: 0 },
    ),
    [safeClaims],
  );

  const batchTotals = useMemo(
    () => safeBatches.reduce(
      (totals, batch) => ({
        approved: totals.approved + Number(batch.approved_amount ?? 0),
        paid: totals.paid + Number(batch.paid_amount ?? 0),
      }),
      { approved: 0, paid: 0 },
    ),
    [safeBatches],
  );

  async function openClaim(id: number) {
    setBusy(true);
    try {
      const response = await getInsuranceClaim(token, tenantSlug, id);
      setSelectedClaim(response.claim);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to open claim.');
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim() {
    if (!selectedClaim) return;
    setBusy(true);
    setError('');
    try {
      const response = await submitInsuranceClaim(
        token,
        tenantSlug,
        selectedClaim.id,
        {
          external_claim_reference: submissionReference || null,
          submission_channel: 'manual',
        },
      );
      setSelectedClaim(response.claim);
      setNotice(response.message || 'Claim submitted.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit claim.');
    } finally {
      setBusy(false);
    }
  }

  async function approveClaim() {
    if (!selectedClaim?.lines?.length) return;
    setBusy(true);
    setError('');
    try {
      const response = await adjudicateInsuranceClaim(
        token,
        tenantSlug,
        selectedClaim.id,
        {
          adjudication_reference:
            adjudicationReference || `ADJ-${selectedClaim.claim_number}`,
          lines: selectedClaim.lines.map((line) => ({
            insurance_claim_line_id: line.id,
            approved_amount: Number(line.claimed_amount ?? 0),
          })),
        },
      );
      setSelectedClaim(response.claim);
      setNotice(response.message || 'Claim adjudicated.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to adjudicate claim.');
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault();
    if (!selectedClaim) return;
    setBusy(true);
    setError('');
    try {
      const response = await createInsuranceClaimPayment(
        token,
        tenantSlug,
        selectedClaim.id,
        {
          payment_reference: paymentReference,
          payment_date: paymentDate,
          amount: Number(paymentAmount),
          method: 'bank_transfer',
        },
      );
      setNotice(response.message || 'Payment recorded.');
      setPaymentReference('');
      setPaymentAmount('');
      await openClaim(selectedClaim.id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to record payment.');
    } finally {
      setBusy(false);
    }
  }

  async function createBatch(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await createInsuranceReconciliationBatch(
        token,
        tenantSlug,
        {
          insurance_partner_id: Number(batchPartner),
          batch_number: batchNumber,
          period_from: periodFrom,
          period_to: periodTo,
          claim_ids: selectedClaimIds,
        },
      );
      setSelectedBatch(response.batch);
      setNotice(response.message || 'Batch created.');
      setBatchNumber('');
      setSelectedClaimIds([]);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create batch.');
    } finally {
      setBusy(false);
    }
  }

  async function submitBatch() {
    if (!selectedBatch) return;
    setBusy(true);
    setError('');
    try {
      const response = await submitInsuranceReconciliationBatch(
        token,
        tenantSlug,
        selectedBatch.id,
      );
      setSelectedBatch(response.batch);
      setNotice(response.message || 'Batch submitted.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit batch.');
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(event: FormEvent) {
    event.preventDefault();
    if (!selectedBatch) return;
    setBusy(true);
    setError('');
    try {
      const response = await reconcileInsuranceBatch(
        token,
        tenantSlug,
        selectedBatch.id,
        {
          payment_ids: selectedPaymentIds,
        },
      );
      setSelectedBatch(response.batch);
      setNotice(response.message || 'Batch reconciled.');
      setSelectedPaymentIds([]);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reconcile batch.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="insurance-live-workspace">
      <header className="insurance-live-toolbar">
        <div>
          <span>Live insurance workflow</span>
          <h3>{mode === 'claims' ? 'Claims management' : 'Reconciliation management'}</h3>
        </div>
        <button type="button" disabled={busy} onClick={() => void load()}>
          {busy ? 'Working…' : 'Refresh'}
        </button>
      </header>

      <div className="insurance-live-filters">
        {mode === 'claims' && (
          <input value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Claim, sale or member number" />
        )}
        <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
          <option value="">All partners</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>{partner.name}</option>
          ))}
        </select>
        <input value={status} onChange={(event) => setStatus(event.target.value)}
          placeholder="Status filter" />
      </div>

      {notice && <div className="insurance-message success">{notice}</div>}
      {error && <div className="insurance-message error">{error}</div>}

      {mode === 'claims' ? (
        <>
          <div className="insurance-live-summary">
            <article><span>Claims</span><strong>{safeClaims.length}</strong></article>
            <article><span>Claimed</span><strong>{money(claimTotals.claimed)} RWF</strong></article>
            <article><span>Approved</span><strong>{money(claimTotals.approved)} RWF</strong></article>
            <article><span>Paid</span><strong>{money(claimTotals.paid)} RWF</strong></article>
          </div>

          <div className="insurance-live-layout">
            <div className="insurance-live-table-wrap">
              <table>
                <thead><tr>
                  <th>Claim</th><th>Partner</th><th>Member / Sale</th>
                  <th>Status</th><th>Claimed</th><th>Approved</th><th>Paid</th><th />
                </tr></thead>
                <tbody>
                  {safeClaims.map((claim) => (
                    <tr key={claim.id}>
                      <td><strong>{claim.claim_number}</strong><small>{claim.service_date || '—'}</small></td>
                      <td>{claim.partner?.name || '—'}</td>
                      <td><strong>{claim.membership?.member_number || '—'}</strong><small>{claim.sale?.sale_number || '—'}</small></td>
                      <td><span className={`insurance-status-pill ${claim.status}`}>{label(claim.status)}</span></td>
                      <td>{money(claim.claimed_amount)}</td>
                      <td>{money(claim.approved_amount)}</td>
                      <td>{money(claim.paid_amount)}</td>
                      <td><button type="button" onClick={() => void openClaim(claim.id)}>Open</button></td>
                    </tr>
                  ))}
                  {!safeClaims.length && <tr><td colSpan={8}>No matching claims.</td></tr>}
                </tbody>
              </table>
            </div>

            <aside className="insurance-live-detail">
              {!selectedClaim ? <p className="muted">Select a claim to review and process.</p> : (
                <>
                  <h3>{selectedClaim.claim_number}</h3>
                  <p><span className={`insurance-status-pill ${selectedClaim.status}`}>{label(selectedClaim.status)}</span></p>
                  <dl>
                    <div><dt>Partner</dt><dd>{selectedClaim.partner?.name || '—'}</dd></div>
                    <div><dt>Member</dt><dd>{selectedClaim.membership?.member_number || '—'}</dd></div>
                    <div><dt>Claimed</dt><dd>{money(selectedClaim.claimed_amount)} RWF</dd></div>
                    <div><dt>Approved</dt><dd>{money(selectedClaim.approved_amount)} RWF</dd></div>
                    <div><dt>Paid</dt><dd>{money(selectedClaim.paid_amount)} RWF</dd></div>
                  </dl>

                  {(selectedClaim.lines || []).map((line) => (
                    <div className="insurance-claim-line" key={line.id}>
                      <strong>{line.description || line.product?.name || `Line ${line.id}`}</strong>
                      <span>{money(line.quantity)} × {money(line.unit_price)} · claimed {money(line.claimed_amount)}</span>
                    </div>
                  ))}

                  {selectedClaim.status === 'draft' && (
                    <div className="insurance-live-form">
                      <input value={submissionReference}
                        onChange={(event) => setSubmissionReference(event.target.value)}
                        placeholder="External claim reference" />
                      <button type="button" disabled={busy} onClick={() => void submitClaim()}>Submit claim</button>
                    </div>
                  )}

                  {['submitted', 'submitted_with_exceptions'].includes(selectedClaim.status) && (
                    <div className="insurance-live-form">
                      <input value={adjudicationReference}
                        onChange={(event) => setAdjudicationReference(event.target.value)}
                        placeholder="Adjudication reference" />
                      <button type="button" disabled={busy} onClick={() => void approveClaim()}>
                        Approve claimed amounts
                      </button>
                    </div>
                  )}

                  {['approved', 'partially_approved', 'partially_paid'].includes(selectedClaim.status) && (
                    <form className="insurance-live-form" onSubmit={recordPayment}>
                      <input required value={paymentReference}
                        onChange={(event) => setPaymentReference(event.target.value)}
                        placeholder="Payment reference" />
                      <input required type="date" value={paymentDate}
                        onChange={(event) => setPaymentDate(event.target.value)} />
                      <input required type="number" min="0.01" step="0.01"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        placeholder="Amount" />
                      <button disabled={busy}>Record payment</button>
                    </form>
                  )}
                </>
              )}
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="insurance-live-summary">
            <article><span>Batches</span><strong>{safeBatches.length}</strong></article>
            <article><span>Approved</span><strong>{money(batchTotals.approved)} RWF</strong></article>
            <article><span>Paid</span><strong>{money(batchTotals.paid)} RWF</strong></article>
            <article><span>Outstanding</span><strong>{money(batchTotals.approved - batchTotals.paid)} RWF</strong></article>
          </div>

          <div className="insurance-live-layout">
            <div>
              <form className="insurance-live-form insurance-live-form--batch" onSubmit={createBatch}>
                <select required value={batchPartner} onChange={(event) => setBatchPartner(event.target.value)}>
                  <option value="">Select partner</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>{partner.name}</option>
                  ))}
                </select>
                <input required value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)}
                  placeholder="Batch number" />
                <input required type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} />
                <input required type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} />
                <div className="insurance-selector-list">
                  <strong>Eligible claims</strong>
                  {eligibleClaims.map((claim) => (
                    <label key={claim.id}>
                      <input
                        type="checkbox"
                        checked={selectedClaimIds.includes(claim.id)}
                        onChange={(event) =>
                          setSelectedClaimIds((current) =>
                            event.target.checked
                              ? [...current, claim.id]
                              : current.filter((id) => id !== claim.id),
                          )
                        }
                      />
                      <span>
                        {claim.claim_number} · {money(claim.approved_amount)} RWF
                      </span>
                    </label>
                  ))}
                  {!eligibleClaims.length && (
                    <small>
                      Select a partner and period to view eligible claims.
                    </small>
                  )}
                </div>
                <button disabled={busy || selectedClaimIds.length === 0}>
                  Create batch ({selectedClaimIds.length})
                </button>
              </form>

              <div className="insurance-live-table-wrap">
                <table>
                  <thead><tr>
                    <th>Batch</th><th>Partner</th><th>Period</th><th>Claims</th>
                    <th>Approved</th><th>Paid</th><th>Status</th><th />
                  </tr></thead>
                  <tbody>
                    {safeBatches.map((batch) => (
                      <tr key={batch.id}>
                        <td><strong>{batch.batch_number}</strong></td>
                        <td>{batch.partner?.name || '—'}</td>
                        <td>{batch.period_from} – {batch.period_to}</td>
                        <td>{batch.claim_count ?? 0}</td>
                        <td>{money(batch.approved_amount)}</td>
                        <td>{money(batch.paid_amount)}</td>
                        <td><span className={`insurance-status-pill ${batch.status}`}>{label(batch.status)}</span></td>
                        <td><button
                          type="button"
                          onClick={() => {
                            setSelectedBatch(batch);
                            setSelectedPaymentIds([]);
                            void getEligibleInsuranceBatchPayments(
                              token,
                              tenantSlug,
                              batch.id,
                            )
                              .then((response) =>
                                setEligiblePayments(
                                  asArray<InsurancePaymentOption>(
                                    response.payments,
                                  ),
                                ),
                              )
                              .catch((reason) =>
                                setError(
                                  reason instanceof Error
                                    ? reason.message
                                    : 'Unable to load eligible payments.',
                                ),
                              );
                          }}
                        >
                          Open
                        </button></td>
                      </tr>
                    ))}
                    {!safeBatches.length && <tr><td colSpan={8}>No matching batches.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="insurance-live-detail">
              {!selectedBatch ? <p className="muted">Select a batch to submit or reconcile.</p> : (
                <>
                  <h3>{selectedBatch.batch_number}</h3>
                  <p><span className={`insurance-status-pill ${selectedBatch.status}`}>{label(selectedBatch.status)}</span></p>
                  <dl>
                    <div><dt>Partner</dt><dd>{selectedBatch.partner?.name || '—'}</dd></div>
                    <div><dt>Claims</dt><dd>{selectedBatch.claim_count ?? 0}</dd></div>
                    <div><dt>Approved</dt><dd>{money(selectedBatch.approved_amount)} RWF</dd></div>
                    <div><dt>Paid</dt><dd>{money(selectedBatch.paid_amount)} RWF</dd></div>
                  </dl>

                  {selectedBatch.status === 'draft' && (
                    <button type="button" disabled={busy} onClick={() => void submitBatch()}>Submit batch</button>
                  )}

                  {['submitted', 'partially_reconciled'].includes(selectedBatch.status) && (
                    <form className="insurance-live-form" onSubmit={reconcile}>
                      <div className="insurance-selector-list">
                        <strong>Eligible payments</strong>
                        {eligiblePayments.map((payment) => (
                          <label key={payment.id}>
                            <input
                              type="checkbox"
                              checked={selectedPaymentIds.includes(payment.id)}
                              onChange={(event) =>
                                setSelectedPaymentIds((current) =>
                                  event.target.checked
                                    ? [...current, payment.id]
                                    : current.filter(
                                        (id) => id !== payment.id,
                                      ),
                                )
                              }
                            />
                            <span>
                              {payment.payment_reference} · {money(payment.amount)} RWF
                            </span>
                          </label>
                        ))}
                        {!eligiblePayments.length && (
                          <small>
                            No eligible unallocated payments are available.
                          </small>
                        )}
                      </div>
                      <button
                        disabled={busy || selectedPaymentIds.length === 0}
                      >
                        Process reconciliation ({selectedPaymentIds.length})
                      </button>
                    </form>
                  )}
                </>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

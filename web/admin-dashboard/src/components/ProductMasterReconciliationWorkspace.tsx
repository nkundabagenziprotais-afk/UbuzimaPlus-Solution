import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getDuplicateProposals,
  getPayerPrices,
  getReconciliationRows,
  getReconciliationSummary,
  reviewDuplicateProposal,
  reviewReconciliationRow,
  type DuplicateProposal,
  type Paginated,
  type PayerPrice,
  type ReconciliationRow,
  type ReconciliationSource,
  type ReconciliationStatus,
  type ReconciliationSummary,
} from '../lib/productMasterReconciliationApi';

type Props = {
  token: string;
  tenantSlug: string;
};

type WorkspaceView =
  | 'overview'
  | 'review'
  | 'duplicates'
  | 'prices';

const emptySummary: ReconciliationSummary = {
  batches: 0,
  rows: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  on_hold: 0,
  missing_candidates: 0,
  correction_candidates: 0,
  duplicate_candidates: 0,
  payer_prices: 0,
};

function emptyPage<T>(): Paginated<T> {
  return {
    current_page: 1,
    data: [],
    from: null,
    last_page: 1,
    per_page: 25,
    to: null,
    total: 0,
  };
}

function numberValue(
  value: string | number | null | undefined,
): number {
  const result = Number(value ?? 0);

  return Number.isFinite(result)
    ? result
    : 0;
}

function formatNumber(
  value: string | number | null | undefined,
): string {
  return new Intl.NumberFormat('en-RW').format(
    numberValue(value),
  );
}

function formatMoney(
  value: string | number | null | undefined,
  currency = 'RWF',
): string {
  return new Intl.NumberFormat(
    'en-RW',
    {
      style: 'currency',
      currency: currency || 'RWF',
      maximumFractionDigits: 2,
    },
  ).format(numberValue(value));
}

function humanize(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not recorded';
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(
      /\b\w/g,
      (character) => character.toUpperCase(),
    );
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not reviewed';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(
      'en-RW',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    ).format(date);
}

function statusClass(status: string): string {
  if (
    status === 'approved'
    || status === 'completed'
    || status === 'active'
  ) {
    return 'pmr-status pmr-status--approved';
  }

  if (
    status === 'rejected'
    || status === 'inactive'
  ) {
    return 'pmr-status pmr-status--rejected';
  }

  if (
    status === 'hold'
    || status.includes('awaiting')
  ) {
    return 'pmr-status pmr-status--hold';
  }

  return 'pmr-status pmr-status--pending';
}

function dependencyRows(
  snapshot: Record<string, unknown> | null,
): number {
  if (!snapshot) {
    return 0;
  }

  const direct = snapshot.total_dependency_rows;

  if (
    typeof direct === 'number'
    && Number.isFinite(direct)
  ) {
    return direct;
  }

  return Object.values(snapshot).reduce<number>(
    (total, value) => {
      if (
        value
        && typeof value === 'object'
        && !Array.isArray(value)
      ) {
        return total + dependencyRows(
          value as Record<string, unknown>,
        );
      }

      return total;
    },
    0,
  );
}

function pageText<T>(page: Paginated<T>): string {
  if (page.total === 0) {
    return 'No records';
  }

  return `${formatNumber(page.from)}–${formatNumber(page.to)} of ${formatNumber(page.total)}`;
}

export function ProductMasterReconciliationWorkspace({
  token,
  tenantSlug,
}: Props) {
  const context = useMemo(
    () => ({
      token,
      tenantSlug,
    }),
    [tenantSlug, token],
  );

  const [activeView, setActiveView] =
    useState<WorkspaceView>('overview');

  const [summary, setSummary] =
    useState(emptySummary);

  const [sources, setSources] =
    useState<ReconciliationSource[]>([]);

  const [rows, setRows] =
    useState<Paginated<ReconciliationRow>>(
      emptyPage(),
    );

  const [duplicates, setDuplicates] =
    useState<Paginated<DuplicateProposal>>(
      emptyPage(),
    );

  const [prices, setPrices] =
    useState<Paginated<PayerPrice>>(
      emptyPage(),
    );

  const [rowSearchDraft, setRowSearchDraft] =
    useState('');
  const [rowSearch, setRowSearch] =
    useState('');
  const [sourceFilter, setSourceFilter] =
    useState('');
  const [actionFilter, setActionFilter] =
    useState('');
  const [rowStatus, setRowStatus] =
    useState<ReconciliationStatus | ''>(
      'pending',
    );
  const [rowPage, setRowPage] = useState(1);

  const [duplicateStatus, setDuplicateStatus] =
    useState<ReconciliationStatus | ''>(
      'pending',
    );
  const [duplicatePage, setDuplicatePage] =
    useState(1);

  const [priceSearchDraft, setPriceSearchDraft] =
    useState('');
  const [priceSearch, setPriceSearch] =
    useState('');
  const [payerFilter, setPayerFilter] =
    useState('');
  const [priceStatus, setPriceStatus] =
    useState('');
  const [pricePage, setPricePage] =
    useState(1);

  const [reviewNotes, setReviewNotes] =
    useState<Record<string, string>>({});

  const [loadingSummary, setLoadingSummary] =
    useState(true);
  const [loadingRows, setLoadingRows] =
    useState(false);
  const [loadingDuplicates, setLoadingDuplicates] =
    useState(false);
  const [loadingPrices, setLoadingPrices] =
    useState(false);

  const [busyKey, setBusyKey] =
    useState('');
  const [error, setError] =
    useState('');
  const [notice, setNotice] =
    useState('');

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);

    try {
      const response =
        await getReconciliationSummary(context);

      setSummary(
        response.data.summary
        ?? emptySummary,
      );

      setSources(
        response.data.sources
        ?? [],
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load the reconciliation summary.',
      );
    } finally {
      setLoadingSummary(false);
    }
  }, [context]);

  const loadRows = useCallback(async () => {
    setLoadingRows(true);

    try {
      setRows(
        await getReconciliationRows(
          context,
          {
            search: rowSearch,
            source: sourceFilter,
            status: rowStatus,
            action: actionFilter,
            page: rowPage,
            perPage: 25,
          },
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load the review queue.',
      );
    } finally {
      setLoadingRows(false);
    }
  }, [
    actionFilter,
    context,
    rowPage,
    rowSearch,
    rowStatus,
    sourceFilter,
  ]);

  const loadDuplicates = useCallback(async () => {
    setLoadingDuplicates(true);

    try {
      setDuplicates(
        await getDuplicateProposals(
          context,
          {
            status: duplicateStatus,
            page: duplicatePage,
            perPage: 25,
          },
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load duplicate proposals.',
      );
    } finally {
      setLoadingDuplicates(false);
    }
  }, [
    context,
    duplicatePage,
    duplicateStatus,
  ]);

  const loadPrices = useCallback(async () => {
    setLoadingPrices(true);

    try {
      setPrices(
        await getPayerPrices(
          context,
          {
            search: priceSearch,
            payer: payerFilter,
            status: priceStatus,
            page: pricePage,
            perPage: 25,
          },
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load payer prices.',
      );
    } finally {
      setLoadingPrices(false);
    }
  }, [
    context,
    payerFilter,
    pricePage,
    priceSearch,
    priceStatus,
  ]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (activeView === 'review') {
      void loadRows();
    }
  }, [activeView, loadRows]);

  useEffect(() => {
    if (activeView === 'duplicates') {
      void loadDuplicates();
    }
  }, [activeView, loadDuplicates]);

  useEffect(() => {
    if (activeView === 'prices') {
      void loadPrices();
    }
  }, [activeView, loadPrices]);

  async function decideRow(
    row: ReconciliationRow,
    status: ReconciliationStatus,
  ) {
    const key = `row-${row.id}`;

    setBusyKey(key);
    setError('');
    setNotice('');

    try {
      const response =
        await reviewReconciliationRow(
          context,
          row.id,
          {
            status,
            notes:
              reviewNotes[key]
              ?? row.review_notes
              ?? null,
          },
        );

      setNotice(response.message);

      await Promise.all([
        loadRows(),
        loadSummary(),
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to record the row decision.',
      );
    } finally {
      setBusyKey('');
    }
  }

  async function decideDuplicate(
    proposal: DuplicateProposal,
    status: ReconciliationStatus,
  ) {
    const key = `duplicate-${proposal.id}`;

    setBusyKey(key);
    setError('');
    setNotice('');

    try {
      const response =
        await reviewDuplicateProposal(
          context,
          proposal.id,
          {
            status,
            notes:
              reviewNotes[key]
              ?? proposal.review_notes
              ?? null,
          },
        );

      setNotice(response.message);

      await Promise.all([
        loadDuplicates(),
        loadSummary(),
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to record the duplicate decision.',
      );
    } finally {
      setBusyKey('');
    }
  }

  function submitRowSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setRowPage(1);
    setRowSearch(rowSearchDraft.trim());
  }

  function submitPriceSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setPricePage(1);
    setPriceSearch(priceSearchDraft.trim());
  }

  const cards = [
    ['Source batches', summary.batches],
    ['Staged rows', summary.rows],
    ['Pending review', summary.pending],
    ['Approved', summary.approved],
    ['Missing products', summary.missing_candidates],
    ['Existing corrections', summary.correction_candidates],
    ['Duplicate proposals', summary.duplicate_candidates],
    ['Payer prices', summary.payer_prices],
  ] as const;

  return (
    <section className="pmr-workspace">
      <header className="pmr-hero">
        <div>
          <span>Controlled Product Master governance</span>
          <h3>Product Master Reconciliation</h3>
          <p>
            Review source catalogues, correct existing products
            in place, protect inventory-linked records and keep
            payer prices separate from retail pricing.
          </p>
        </div>

        <div className="pmr-tenant-context">
          <small>Active tenant</small>
          <strong>{tenantSlug}</strong>
          <span>Human approval required</span>
        </div>
      </header>

      <nav
        className="pmr-tabs"
        aria-label="Product Master reconciliation workspaces"
      >
        {[
          ['overview', 'Overview'],
          ['review', 'Review queue'],
          ['duplicates', 'Duplicate review'],
          ['prices', 'Payer pricing'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={
              activeView === key
                ? 'active'
                : ''
            }
            onClick={() => {
              setActiveView(key as WorkspaceView);
              setError('');
              setNotice('');
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div
          className="pmr-message pmr-message--error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="pmr-message pmr-message--success"
          role="status"
        >
          {notice}
        </div>
      )}

      {activeView === 'overview' && (
        <>
          <section className="pmr-summary-grid">
            {cards.map(([label, value]) => (
              <article
                key={label}
                className="pmr-summary-card"
              >
                <span>{label}</span>
                <strong>
                  {loadingSummary
                    ? '…'
                    : formatNumber(value)}
                </strong>
              </article>
            ))}
          </section>

          <section className="pmr-panel">
            <header className="pmr-panel-header">
              <div>
                <span>Source coverage</span>
                <h4>Registered source batches</h4>
                <p>
                  Source identity, version and review counters
                  remain visible throughout reconciliation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadSummary()}
                disabled={loadingSummary}
              >
                Refresh
              </button>
            </header>

            {sources.length === 0 ? (
              <div className="pmr-empty">
                No staged sources are available.
              </div>
            ) : (
              <div className="pmr-source-grid">
                {sources.map((source) => (
                  <article
                    key={source.id}
                    className="pmr-source-card"
                  >
                    <header>
                      <div>
                        <small>{source.source_key}</small>
                        <strong>{source.source_name}</strong>
                      </div>

                      <span
                        className={statusClass(
                          source.status,
                        )}
                      >
                        {humanize(source.status)}
                      </span>
                    </header>

                    <dl>
                      <div>
                        <dt>Imported</dt>
                        <dd>
                          {formatNumber(
                            source.imported_rows,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Matched</dt>
                        <dd>
                          {formatNumber(
                            source.matched_rows,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Review</dt>
                        <dd>
                          {formatNumber(
                            source.review_rows,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Approved</dt>
                        <dd>
                          {formatNumber(
                            source.approved_rows,
                          )}
                        </dd>
                      </div>
                    </dl>

                    <small>
                      Version:
                      {' '}
                      {source.source_version.slice(0, 12)}
                    </small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="pmr-guardrails">
            <article>
              <strong>Preserve linked records</strong>
              <p>
                Existing products are corrected in place so
                product IDs, stock, sales, procurement and claim
                links remain intact.
              </p>
            </article>

            <article>
              <strong>No automatic fuzzy activation</strong>
              <p>
                Ambiguous or low-confidence matches remain pending
                until an administrator records a decision.
              </p>
            </article>

            <article>
              <strong>Separate payer pricing</strong>
              <p>
                RSSB/RHIA, Eden Care and other reimbursement
                values remain separate from retail prices.
              </p>
            </article>
          </section>
        </>
      )}

      {activeView === 'review' && (
        <section className="pmr-panel">
          <header className="pmr-panel-header">
            <div>
              <span>Human review queue</span>
              <h4>Source-to-Product Master decisions</h4>
              <p>
                Review provenance, match confidence and dependency
                impact before approving, holding or rejecting.
              </p>
            </div>

            <strong>{pageText(rows)}</strong>
          </header>

          <form
            className="pmr-filter-grid"
            onSubmit={submitRowSearch}
          >
            <label>
              <span>Search</span>
              <input
                value={rowSearchDraft}
                placeholder="Code, product or generic"
                onChange={(event) =>
                  setRowSearchDraft(event.target.value)}
              />
            </label>

            <label>
              <span>Source</span>
              <select
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value);
                  setRowPage(1);
                }}
              >
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option
                    key={source.id}
                    value={source.source_key}
                  >
                    {source.source_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Status</span>
              <select
                value={rowStatus}
                onChange={(event) => {
                  setRowStatus(
                    (event.target.value as ReconciliationStatus | ''),
                  );
                  setRowPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="hold">On hold</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>

            <label>
              <span>Action</span>
              <select
                value={actionFilter}
                onChange={(event) => {
                  setActionFilter(event.target.value);
                  setRowPage(1);
                }}
              >
                <option value="">All actions</option>
                <option value="keep_existing">
                  Keep existing
                </option>
                <option value="confirm_match">
                  Confirm match
                </option>
                <option value="update_existing">
                  Update existing
                </option>
                <option value="create_missing">
                  Create missing
                </option>
              </select>
            </label>

            <button type="submit">
              Apply filters
            </button>
          </form>

          {loadingRows ? (
            <div className="pmr-empty">
              Loading reconciliation rows…
            </div>
          ) : rows.data.length === 0 ? (
            <div className="pmr-empty">
              No rows match the current filters.
            </div>
          ) : (
            <div className="pmr-review-list">
              {rows.data.map((row) => {
                const key = `row-${row.id}`;

                return (
                  <article
                    key={row.id}
                    className="pmr-review-card"
                  >
                    <header>
                      <div>
                        <small>
                          {row.batch?.source_name
                            ?? 'Unknown source'}
                          {' · '}
                          Row {formatNumber(row.source_row)}
                          {' · '}
                          {row.source_code
                            || 'No source code'}
                        </small>

                        <h5>{row.product_name}</h5>
                        <p>
                          {row.generic_name
                            || 'Generic description not supplied'}
                        </p>
                      </div>

                      <div className="pmr-card-statuses">
                        <span
                          className={statusClass(
                            row.review_status,
                          )}
                        >
                          {humanize(row.review_status)}
                        </span>

                        <span className="pmr-action-chip">
                          {humanize(row.proposed_action)}
                        </span>
                      </div>
                    </header>

                    <div className="pmr-comparison-grid">
                      <section>
                        <strong>Source proposal</strong>
                        <dl>
                          <div>
                            <dt>Selling unit</dt>
                            <dd>
                              {row.selling_unit
                                || 'Not supplied'}
                            </dd>
                          </div>
                          <div>
                            <dt>Source price</dt>
                            <dd>
                              {row.source_price === null
                                ? 'Not supplied'
                                : formatMoney(
                                  row.source_price,
                                  row.currency ?? 'RWF',
                                )}
                            </dd>
                          </div>
                          <div>
                            <dt>Match method</dt>
                            <dd>
                              {humanize(row.match_method)}
                            </dd>
                          </div>
                          <div>
                            <dt>Confidence</dt>
                            <dd>
                              {formatNumber(row.match_score)}%
                            </dd>
                          </div>
                        </dl>
                      </section>

                      <section>
                        <strong>Matched Product Master</strong>

                        {row.matched_product ? (
                          <dl>
                            <div>
                              <dt>SKU</dt>
                              <dd>
                                {row.matched_product.sku}
                              </dd>
                            </div>
                            <div>
                              <dt>Name</dt>
                              <dd>
                                {row.matched_product.name}
                              </dd>
                            </div>
                            <div>
                              <dt>Generic</dt>
                              <dd>
                                {row.matched_product.generic_name
                                  || 'Not recorded'}
                              </dd>
                            </div>
                            <div>
                              <dt>Status</dt>
                              <dd>
                                {humanize(
                                  row.matched_product.status,
                                )}
                              </dd>
                            </div>
                          </dl>
                        ) : (
                          <p className="pmr-no-match">
                            No safe existing-product match.
                          </p>
                        )}
                      </section>
                    </div>

                    <div className="pmr-impact">
                      <strong>
                        {formatNumber(
                          dependencyRows(
                            row.dependency_snapshot,
                          ),
                        )}
                        {' '}
                        linked dependency rows
                      </strong>
                      <span>
                        Product identity and business history must
                        remain intact.
                      </span>
                    </div>

                    <label className="pmr-notes">
                      <span>Administrator notes</span>
                      <textarea
                        value={
                          reviewNotes[key]
                          ?? row.review_notes
                          ?? ''
                        }
                        placeholder="Record the evidence or decision reason."
                        onChange={(event) =>
                          setReviewNotes((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))}
                      />
                    </label>

                    <footer>
                      <small>
                        Last decision:
                        {' '}
                        {formatDate(row.reviewed_at)}
                      </small>

                      <div className="pmr-actions">
                        <button
                          type="button"
                          className="pmr-approve"
                          disabled={busyKey !== ''}
                          onClick={() =>
                            void decideRow(
                              row,
                              'approved',
                            )}
                        >
                          {busyKey === key
                            ? 'Recording…'
                            : 'Approve'}
                        </button>

                        <button
                          type="button"
                          className="pmr-hold"
                          disabled={busyKey !== ''}
                          onClick={() =>
                            void decideRow(
                              row,
                              'hold',
                            )}
                        >
                          Hold
                        </button>

                        <button
                          type="button"
                          className="pmr-reject"
                          disabled={busyKey !== ''}
                          onClick={() =>
                            void decideRow(
                              row,
                              'rejected',
                            )}
                        >
                          Reject
                        </button>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}

          <div className="pmr-pagination">
            <button
              type="button"
              disabled={
                loadingRows
                || rows.current_page <= 1
              }
              onClick={() =>
                setRowPage((page) =>
                  Math.max(1, page - 1))}
            >
              Previous
            </button>

            <span>
              Page {rows.current_page}
              {' '}
              of {rows.last_page}
            </span>

            <button
              type="button"
              disabled={
                loadingRows
                || rows.current_page >= rows.last_page
              }
              onClick={() =>
                setRowPage((page) =>
                  Math.min(
                    rows.last_page,
                    page + 1,
                  ))}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {activeView === 'duplicates' && (
        <section className="pmr-panel">
          <header className="pmr-panel-header">
            <div>
              <span>Duplicate governance</span>
              <h4>Potential duplicate products</h4>
              <p>
                Compare both records and dependency impact.
                Approval records a decision but does not delete
                or merge inventory history.
              </p>
            </div>

            <strong>{pageText(duplicates)}</strong>
          </header>

          <label className="pmr-single-filter">
            <span>Status</span>
            <select
              value={duplicateStatus}
              onChange={(event) => {
                setDuplicateStatus(
                  (event.target.value as ReconciliationStatus | ''),
                );
                setDuplicatePage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="hold">On hold</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          {loadingDuplicates ? (
            <div className="pmr-empty">
              Loading duplicate proposals…
            </div>
          ) : duplicates.data.length === 0 ? (
            <div className="pmr-empty">
              No duplicate proposals match this status.
            </div>
          ) : (
            <div className="pmr-review-list">
              {duplicates.data.map((proposal) => {
                const key =
                  `duplicate-${proposal.id}`;

                return (
                  <article
                    key={proposal.id}
                    className="pmr-review-card"
                  >
                    <header>
                      <div>
                        <small>Match basis</small>
                        <h5>
                          {proposal.match_basis
                            || 'Potential duplicate'}
                        </h5>
                      </div>

                      <div className="pmr-card-statuses">
                        <span
                          className={statusClass(
                            proposal.status,
                          )}
                        >
                          {humanize(proposal.status)}
                        </span>

                        <span className="pmr-action-chip">
                          {formatNumber(
                            proposal.match_score,
                          )}
                          % match
                        </span>
                      </div>
                    </header>

                    <div className="pmr-comparison-grid">
                      {[
                        ['Record A', proposal.record_a],
                        ['Record B', proposal.record_b],
                      ].map(([label, product]) => (
                        <section key={String(label)}>
                          <strong>{String(label)}</strong>

                          {product
                            && typeof product === 'object' ? (
                            <dl>
                              <div>
                                <dt>SKU</dt>
                                <dd>{product.sku}</dd>
                              </div>
                              <div>
                                <dt>Name</dt>
                                <dd>{product.name}</dd>
                              </div>
                              <div>
                                <dt>Generic</dt>
                                <dd>
                                  {product.generic_name
                                    || 'Not recorded'}
                                </dd>
                              </div>
                              <div>
                                <dt>Unit</dt>
                                <dd>
                                  {product.unit
                                    || 'Not recorded'}
                                </dd>
                              </div>
                            </dl>
                          ) : (
                            <p className="pmr-no-match">
                              Product record unavailable.
                            </p>
                          )}
                        </section>
                      ))}
                    </div>

                    <div className="pmr-impact">
                      <strong>
                        {formatNumber(
                          dependencyRows(
                            proposal.dependency_snapshot,
                          ),
                        )}
                        {' '}
                        linked dependency rows
                      </strong>
                      <span>
                        Consolidation requires a later controlled,
                        transactional process.
                      </span>
                    </div>

                    <label className="pmr-notes">
                      <span>Administrator notes</span>
                      <textarea
                        value={
                          reviewNotes[key]
                          ?? proposal.review_notes
                          ?? ''
                        }
                        placeholder="Record why these products should remain separate, be held or proceed."
                        onChange={(event) =>
                          setReviewNotes((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))}
                      />
                    </label>

                    <footer>
                      <small>
                        Last decision:
                        {' '}
                        {formatDate(proposal.reviewed_at)}
                      </small>

                      <div className="pmr-actions">
                        <button
                          type="button"
                          className="pmr-approve"
                          disabled={busyKey !== ''}
                          onClick={() =>
                            void decideDuplicate(
                              proposal,
                              'approved',
                            )}
                        >
                          {busyKey === key
                            ? 'Recording…'
                            : 'Approve proposal'}
                        </button>

                        <button
                          type="button"
                          className="pmr-hold"
                          disabled={busyKey !== ''}
                          onClick={() =>
                            void decideDuplicate(
                              proposal,
                              'hold',
                            )}
                        >
                          Hold
                        </button>

                        <button
                          type="button"
                          className="pmr-reject"
                          disabled={busyKey !== ''}
                          onClick={() =>
                            void decideDuplicate(
                              proposal,
                              'rejected',
                            )}
                        >
                          Keep separate
                        </button>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}

          <div className="pmr-pagination">
            <button
              type="button"
              disabled={
                loadingDuplicates
                || duplicates.current_page <= 1
              }
              onClick={() =>
                setDuplicatePage((page) =>
                  Math.max(1, page - 1))}
            >
              Previous
            </button>

            <span>
              Page {duplicates.current_page}
              {' '}
              of {duplicates.last_page}
            </span>

            <button
              type="button"
              disabled={
                loadingDuplicates
                || duplicates.current_page
                  >= duplicates.last_page
              }
              onClick={() =>
                setDuplicatePage((page) =>
                  Math.min(
                    duplicates.last_page,
                    page + 1,
                  ))}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {activeView === 'prices' && (
        <section className="pmr-panel">
          <header className="pmr-panel-header">
            <div>
              <span>Price-source separation</span>
              <h4>Payer and reimbursement prices</h4>
              <p>
                Review payer, source reference, effective period
                and approval status without replacing retail
                pricing.
              </p>
            </div>

            <strong>{pageText(prices)}</strong>
          </header>

          <form
            className="pmr-filter-grid pmr-filter-grid--prices"
            onSubmit={submitPriceSearch}
          >
            <label>
              <span>Search</span>
              <input
                value={priceSearchDraft}
                placeholder="Product, SKU or source reference"
                onChange={(event) =>
                  setPriceSearchDraft(event.target.value)}
              />
            </label>

            <label>
              <span>Payer code</span>
              <input
                value={payerFilter}
                placeholder="Example: RSSB_RHIA"
                onChange={(event) => {
                  setPayerFilter(event.target.value);
                  setPricePage(1);
                }}
              />
            </label>

            <label>
              <span>Status</span>
              <select
                value={priceStatus}
                onChange={(event) => {
                  setPriceStatus(event.target.value);
                  setPricePage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <button type="submit">
              Apply filters
            </button>
          </form>

          {loadingPrices ? (
            <div className="pmr-empty">
              Loading payer prices…
            </div>
          ) : prices.data.length === 0 ? (
            <div className="pmr-empty">
              No payer prices match the current filters.
            </div>
          ) : (
            <div className="pmr-table-wrap">
              <table className="pmr-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Payer</th>
                    <th>Amount</th>
                    <th>Source</th>
                    <th>Effective period</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {prices.data.map((price) => (
                    <tr key={price.id}>
                      <td>
                        <strong>
                          {price.product?.name
                            || 'Product unavailable'}
                        </strong>
                        <small>
                          {price.product?.sku
                            || 'No SKU'}
                        </small>
                      </td>
                      <td>
                        <strong>{price.payer_name}</strong>
                        <small>{price.payer_code}</small>
                      </td>
                      <td>
                        {formatMoney(
                          price.amount,
                          price.currency,
                        )}
                      </td>
                      <td>
                        <strong>
                          {humanize(price.source_key)}
                        </strong>
                        <small>
                          {price.source_reference
                            || 'No reference'}
                        </small>
                      </td>
                      <td>
                        <span>
                          {price.effective_from
                            || 'Open'}
                        </span>
                        <small>
                          to
                          {' '}
                          {price.effective_to
                            || 'open-ended'}
                        </small>
                      </td>
                      <td>
                        <span
                          className={statusClass(
                            price.status,
                          )}
                        >
                          {humanize(price.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pmr-pagination">
            <button
              type="button"
              disabled={
                loadingPrices
                || prices.current_page <= 1
              }
              onClick={() =>
                setPricePage((page) =>
                  Math.max(1, page - 1))}
            >
              Previous
            </button>

            <span>
              Page {prices.current_page}
              {' '}
              of {prices.last_page}
            </span>

            <button
              type="button"
              disabled={
                loadingPrices
                || prices.current_page >= prices.last_page
              }
              onClick={() =>
                setPricePage((page) =>
                  Math.min(
                    prices.last_page,
                    page + 1,
                  ))}
            >
              Next
            </button>
          </div>
        </section>
      )}
    </section>
  );
}

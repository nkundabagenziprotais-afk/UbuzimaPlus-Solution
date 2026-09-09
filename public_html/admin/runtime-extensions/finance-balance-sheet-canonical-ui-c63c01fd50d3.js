(() => {
  'use strict';

  const RELEASE =
    '2026.08.finance-balance-canonical-ui-r1';

  const ROOT_ID =
    'aquila-finance-balance-sheet-r22';

  const OWNER_ATTR =
    'data-aquila-balance-canonical-ui-owner';

  const CORE_ENDPOINT =
    '/api/v1/pharmaco/finance/commercial/balance-sheet';

  const state = {
    asOf:
      new Date().toISOString().slice(0, 10),

    compareMode:
      'none',

    compareAsOf:
      '',

    current:
      null,

    comparison:
      null,

    loading:
      false,

    error:
      '',

    expanded: {
      assets: false,
      liabilities: false,
      equity: false,
    },

    hiddenStage:
      null,
  };

  const clean = value =>
    String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const escapeHtml = value =>
    clean(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const number = value => {
    const parsed =
      Number(value ?? 0);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  };

  const money = value =>
    'RF ' +
    new Intl.NumberFormat(
      'en-RW',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    ).format(
      number(value)
    );

  const dateLabel = value => {
    if (!value) {
      return '—';
    }

    const parts =
      String(value).split('-');

    if (parts.length !== 3) {
      return clean(value);
    }

    return (
      parts[2]
      + ' '
      + new Date(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2])
        )
          .toLocaleString(
            'en',
            {
              month: 'short',
            }
          )
      + ' '
      + parts[0]
    );
  };

  const routeIsBalance = () => {
    const params =
      new URLSearchParams(
        String(location.hash || '')
          .replace(/^#/, '')
      );

    return (
      params.get('section') === 'finance'
      &&
      params.get('finance') ===
        'financial-statements'
      &&
      params.get('statement') ===
        'balance-sheet'
    );
  };

  const authContext = () => {
    const read = (storage, key) => {
      try {
        return storage.getItem(key) || '';
      } catch {
        return '';
      }
    };

    const parse = raw => {
      try {
        return raw
          ? JSON.parse(raw)
          : null;
      } catch {
        return null;
      }
    };

    const first = (...values) =>
      values.find(
        value =>
          typeof value === 'string'
          &&
          value.trim()
      )?.trim()
      || '';

    const sessions = [
      parse(
        read(
          localStorage,
          'ubuzima_admin_session'
        )
      ),

      parse(
        read(
          sessionStorage,
          'ubuzima_admin_session'
        )
      ),
    ].filter(Boolean);

    let token =
      first(
        read(
          localStorage,
          'ubuzima.token'
        ),

        read(
          sessionStorage,
          'ubuzima.token'
        ),

        read(
          localStorage,
          'access_token'
        ),

        read(
          sessionStorage,
          'access_token'
        ),

        read(
          localStorage,
          'authToken'
        ),

        read(
          sessionStorage,
          'authToken'
        )
      );

    let tenant =
      first(
        read(
          localStorage,
          'ubuzima.currentTenantSlug'
        ),

        read(
          sessionStorage,
          'ubuzima.currentTenantSlug'
        ),

        read(
          localStorage,
          'pharmaco.tenantSlug'
        ),

        read(
          sessionStorage,
          'pharmaco.tenantSlug'
        )
      );

    for (const session of sessions) {
      token ||=
        first(
          session?.token,
          session?.access_token,
          session?.accessToken
        );

      tenant ||=
        first(
          session?.tenant_slug,
          session?.tenantSlug,
          session?.tenant?.slug,
          session?.profile
            ?.tenant
            ?.slug,
          session?.profile
            ?.tenant_assignments
            ?.[0]
            ?.tenant
            ?.slug,
          session
            ?.tenant_assignments
            ?.[0]
            ?.tenant
            ?.slug
        );
    }

    return {
      token,
      tenant,
    };
  };


  function normalizeBalanceSnapshotPayload(payload) {
    const root =
      payload
      &&
      typeof payload === 'object'
        ? payload
        : {};

    const candidates = [
      root?.current,
      root?.data?.current,
      root?.data,
      root?.snapshot,
      root,
    ];

    for (const candidate of candidates) {
      if (
        candidate
        &&
        typeof candidate === 'object'
        &&
        candidate.summary
        &&
        candidate.sections
      ) {
        return candidate;
      }
    }

    return root;
  }

  async function apiGet(asOf) {
    const auth =
      authContext();

    if (
      !auth.token
      ||
      !auth.tenant
    ) {
      throw new Error(
        'Secure Finance session could not be resolved.'
      );
    }

    const url =
      new URL(
        CORE_ENDPOINT,
        location.origin
      );

    if (asOf) {
      url.searchParams.set(
        'as_of',
        asOf
      );
    }

    const response =
      await fetch(
        url.toString(),
        {
          method:
            'GET',

          headers: {
            Accept:
              'application/json',

            Authorization:
              `Bearer ${auth.token}`,

            'X-Tenant-Slug':
              auth.tenant,
          },

          credentials:
            'include',

          cache:
            'no-store',
        }
      );

    let payload =
      null;

    try {
      payload =
        await response.json();
    } catch {
      payload =
        null;
    }

    if (!response.ok) {
      throw new Error(
        'Balance Sheet could not be loaded (HTTP '
        + response.status
        + ').'
      );
    }

    return normalizeBalanceSnapshotPayload(
payload || {}
    );
  }

  const nativeStage = () =>
    document.querySelector(
      '.module-section-stage'
      + '[data-finance-module-stage="active"]'
    );

  const pageHost = () => {
    const stage =
      nativeStage();

    return (
      stage?.closest(
        'section.section-page.dedicated-module-page'
      )
      ||
      document.querySelector(
        'section.section-page.dedicated-module-page'
      )
      ||
      null
    );
  };

  const hideNativeStatement = () => {
    const stage =
      nativeStage();

    if (!stage) {
      return;
    }

    if (
      state.hiddenStage
      &&
      state.hiddenStage !== stage
    ) {
      restoreNativeStatement();
    }

    if (!state.hiddenStage) {
      state.hiddenStage =
        stage;

      stage.dataset
        .aquilaBalancePreviousDisplay =
          stage.style.display || '';

      stage.dataset
        .aquilaBalancePreviousHidden =
          stage.hidden
            ? '1'
            : '0';
    }

    stage.hidden =
      true;

    stage.style.setProperty(
      'display',
      'none',
      'important'
    );
  };

  const restoreNativeStatement = () => {
    const stage =
      state.hiddenStage;

    if (!stage) {
      return;
    }

    const oldDisplay =
      stage.dataset
        .aquilaBalancePreviousDisplay
      || '';

    const oldHidden =
      stage.dataset
        .aquilaBalancePreviousHidden
      === '1';

    if (oldDisplay) {
      stage.style.display =
        oldDisplay;
    } else {
      stage.style.removeProperty(
        'display'
      );
    }

    stage.hidden =
      oldHidden;

    delete stage.dataset
      .aquilaBalancePreviousDisplay;

    delete stage.dataset
      .aquilaBalancePreviousHidden;

    state.hiddenStage =
      null;
  };

  const root = () =>
    document.getElementById(
      ROOT_ID
    );

  const ensureRoot = () => {
    let target =
      root();

    if (target) {
      return target;
    }

    const host =
      pageHost();

    if (!host) {
      return null;
    }

    target =
      document.createElement(
        'section'
      );

    target.id =
      ROOT_ID;

    target.className =
      'aq-bs-canonical';

    target.setAttribute(
      OWNER_ATTR,
      '1'
    );

    target.setAttribute(
      'aria-label',
      'Balance Sheet'
    );

    const stage =
      nativeStage();

    if (
      stage
      &&
      stage.parentElement === host
    ) {
      stage.insertAdjacentElement(
        'afterend',
        target
      );
    } else {
      host.appendChild(
        target
      );
    }

    return target;
  };

  const sectionRows = (
    key,
    section
  ) => {
    const rows =
      Array.isArray(
        section?.rows
      )
        ? section.rows
        : [];

    const expanded =
      Boolean(
        state.expanded[key]
      );

    const displayRows =
      expanded
        ? rows
        : rows.slice(0, 12);

    const body =
      displayRows.length
        ? displayRows
            .map(
              row => `
                <tr>
                  <td>
                    <span class="aq-bs-code">
                      ${escapeHtml(row?.code || '—')}
                    </span>
                    <strong>
                      ${escapeHtml(row?.name || 'Unnamed account')}
                    </strong>
                  </td>
                  <td>
                    ${escapeHtml(money(row?.balance))}
                  </td>
                </tr>
              `
            )
            .join('')
        : `
            <tr>
              <td colspan="2" class="aq-bs-empty">
                No accounts in this classification.
              </td>
            </tr>
          `;

    const more =
      rows.length > 12
        ? `
            <button
              type="button"
              class="aq-bs-more"
              data-action="toggle-section"
              data-section="${escapeHtml(key)}"
            >
              ${
                expanded
                  ? 'Show fewer accounts'
                  : `See all ${rows.length} accounts`
              }
            </button>
          `
        : '';

    return {
      body,
      more,
      total:
        number(
          section?.total
        ),
    };
  };

  const comparisonText = (
    current,
    comparison
  ) => {
    if (
      !comparison
      ||
      state.compareMode === 'none'
    ) {
      return '';
    }

    const difference =
      number(current)
      -
      number(comparison);

    const prefix =
      difference > 0
        ? '+'
        : '';

    return (
      prefix
      + money(difference)
      + ' vs '
      + dateLabel(
          state.compareAsOf
        )
    );
  };

  function render() {
    const target =
      ensureRoot();

    if (!target) {
      return;
    }

    if (
      state.loading
      &&
      !state.current
    ) {
      target.innerHTML = `
        <div class="aq-bs-loading">
          Loading authoritative Balance Sheet…
        </div>
      `;

      return;
    }

    if (
      state.error
      &&
      !state.current
    ) {
      target.innerHTML = `
        <div class="aq-bs-error">
          <strong>Balance Sheet could not be loaded.</strong>
          <span>${escapeHtml(state.error)}</span>
          <button
            type="button"
            data-action="refresh"
          >
            Try again
          </button>
        </div>
      `;

      return;
    }

    const data =
      state.current || {};

    const comparison =
      state.comparison || {};

    const summary =
      data.summary || {};

    const compareSummary =
      comparison.summary || {};

    const sections =
      data.sections || {};

    const assets =
      sectionRows(
        'assets',
        sections.assets
      );

    const liabilities =
      sectionRows(
        'liabilities',
        sections.liabilities
      );

    const equity =
      sectionRows(
        'equity',
        sections.equity
      );

    const totalAssets =
      number(
        summary.total_assets
      );

    const totalLiabilities =
      number(
        summary.total_liabilities
      );

    const totalEquity =
      number(
        summary.total_equity
      );

    const difference =
      number(
        summary.balance_difference
      );

    const balanced =
      Boolean(
        summary.balanced
      );

    const liabilityPercent =
      totalAssets !== 0
        ? Math.max(
            0,
            Math.min(
              100,
              (
                totalLiabilities
                /
                Math.abs(totalAssets)
              )
              *
              100
            )
          )
        : 0;

    const equityPercent =
      totalAssets !== 0
        ? Math.max(
            0,
            Math.min(
              100,
              (
                totalEquity
                /
                Math.abs(totalAssets)
              )
              *
              100
            )
          )
        : 0;

    const liabilityDegrees =
      liabilityPercent
      *
      3.6;

    const diagnostics =
      data.diagnostics || {};

    const classificationComplete =
      diagnostics
        .classification_complete
      !== false;

    const asOf =
      data.as_of
      ||
      state.asOf;

    target.innerHTML = `
      <header class="aq-bs-header">
        <div>
          <button
            type="button"
            class="aq-bs-back"
            data-action="back"
          >
            ← Back to Finance
          </button>

          <p class="aq-bs-kicker">
            FINANCE · FINANCIAL STATEMENTS
          </p>

          <h1>Balance Sheet</h1>

          <p class="aq-bs-subtitle">
            Assets, liabilities and equity from the authoritative posted ledger.
          </p>
        </div>

        <div class="aq-bs-actions">
          <button
            type="button"
            data-action="refresh"
          >
            ↻ Refresh
          </button>

          <button
            type="button"
            data-action="export"
          >
            ⇩ Export CSV
          </button>
        </div>
      </header>

      <section class="aq-bs-filters">
        <label>
          <span>As of</span>
          <input
            type="date"
            name="as-of"
            value="${escapeHtml(state.asOf)}"
          >
        </label>

        <label>
          <span>Compare with</span>
          <select name="compare-mode">
            <option
              value="none"
              ${
                state.compareMode === 'none'
                  ? 'selected'
                  : ''
              }
            >
              None
            </option>

            <option
              value="custom"
              ${
                state.compareMode === 'custom'
                  ? 'selected'
                  : ''
              }
            >
              Custom date
            </option>
          </select>
        </label>

        <label>
          <span>Comparison date</span>
          <input
            type="date"
            name="compare-as-of"
            value="${escapeHtml(state.compareAsOf)}"
            ${
              state.compareMode === 'none'
                ? 'disabled'
                : ''
            }
          >
        </label>
      </section>

      ${
        state.error
          ? `
              <div class="aq-bs-inline-warning">
                ${escapeHtml(state.error)}
              </div>
            `
          : ''
      }

      <section class="aq-bs-metrics">
        <article class="aq-bs-metric">
          <div class="aq-bs-metric-icon aq-bs-blue">
            ▣
          </div>

          <div>
            <span>Total Assets</span>
            <strong>${escapeHtml(money(totalAssets))}</strong>
            <small>
              ${
                comparisonText(
                  totalAssets,
                  compareSummary.total_assets
                )
                ||
                `As at ${escapeHtml(dateLabel(asOf))}`
              }
            </small>
          </div>
        </article>

        <article class="aq-bs-metric">
          <div class="aq-bs-metric-icon aq-bs-orange">
            ▤
          </div>

          <div>
            <span>Total Liabilities</span>
            <strong>${escapeHtml(money(totalLiabilities))}</strong>
            <small>
              ${
                comparisonText(
                  totalLiabilities,
                  compareSummary.total_liabilities
                )
                ||
                'Authoritative posted ledger'
              }
            </small>
          </div>
        </article>

        <article class="aq-bs-metric">
          <div class="aq-bs-metric-icon aq-bs-green">
            ▥
          </div>

          <div>
            <span>Total Equity</span>
            <strong>${escapeHtml(money(totalEquity))}</strong>
            <small>
              ${
                comparisonText(
                  totalEquity,
                  compareSummary.total_equity
                )
                ||
                'Includes accumulated earnings'
              }
            </small>
          </div>
        </article>

        <article class="aq-bs-metric">
          <div class="aq-bs-metric-icon aq-bs-purple">
            ⚖
          </div>

          <div>
            <span>Accounting equation</span>

            <strong
              class="${
                balanced
                  ? 'aq-bs-balanced'
                  : 'aq-bs-review'
              }"
            >
              ${
                balanced
                  ? 'Balanced'
                  : 'Review required'
              }
            </strong>

            <small>
              Difference:
              ${escapeHtml(money(difference))}
            </small>
          </div>
        </article>
      </section>

      <section class="aq-bs-position-grid">
        <article class="aq-bs-ledger aq-bs-ledger-assets">
          <header>
            <strong>Assets</strong>
            <span>${escapeHtml(money(assets.total))}</span>
          </header>

          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>${escapeHtml(dateLabel(asOf))}</th>
              </tr>
            </thead>

            <tbody>
              ${assets.body}
            </tbody>
          </table>

          ${assets.more}

          <footer>
            <strong>Total Assets</strong>
            <strong>${escapeHtml(money(assets.total))}</strong>
          </footer>
        </article>

        <article class="aq-bs-ledger aq-bs-ledger-liabilities">
          <header>
            <strong>Liabilities</strong>
            <span>${escapeHtml(money(liabilities.total))}</span>
          </header>

          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>${escapeHtml(dateLabel(asOf))}</th>
              </tr>
            </thead>

            <tbody>
              ${liabilities.body}
            </tbody>
          </table>

          ${liabilities.more}

          <footer>
            <strong>Total Liabilities</strong>
            <strong>${escapeHtml(money(liabilities.total))}</strong>
          </footer>
        </article>

        <article class="aq-bs-ledger aq-bs-ledger-equity">
          <header>
            <strong>Equity &amp; Accumulated Earnings</strong>
            <span>${escapeHtml(money(equity.total))}</span>
          </header>

          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>${escapeHtml(dateLabel(asOf))}</th>
              </tr>
            </thead>

            <tbody>
              ${equity.body}
            </tbody>
          </table>

          ${equity.more}

          <footer>
            <strong>Total Equity</strong>
            <strong>${escapeHtml(money(equity.total))}</strong>
          </footer>
        </article>

        <aside class="aq-bs-rail">
          <article class="aq-bs-panel">
            <h2>Position Summary</h2>

            <div class="aq-bs-summary-chart">
              <div
                class="aq-bs-donut"
                style="--aq-bs-liability-deg:${liabilityDegrees}deg"
                aria-label="Liabilities and equity composition"
              ></div>

              <div class="aq-bs-summary-legend">
                <div>
                  <i class="aq-bs-dot aq-bs-dot-blue"></i>
                  <span>Assets</span>
                  <strong>${escapeHtml(money(totalAssets))}</strong>
                  <small>100%</small>
                </div>

                <div>
                  <i class="aq-bs-dot aq-bs-dot-orange"></i>
                  <span>Liabilities</span>
                  <strong>${escapeHtml(money(totalLiabilities))}</strong>
                  <small>${liabilityPercent.toFixed(2)}%</small>
                </div>

                <div>
                  <i class="aq-bs-dot aq-bs-dot-green"></i>
                  <span>Equity</span>
                  <strong>${escapeHtml(money(totalEquity))}</strong>
                  <small>${equityPercent.toFixed(2)}%</small>
                </div>
              </div>
            </div>
          </article>

          <article class="aq-bs-panel">
            <h2>Statement Basis</h2>

            <dl>
              <div>
                <dt>Basis</dt>
                <dd>Authoritative posted ledger</dd>
              </div>

              <div>
                <dt>Classification</dt>
                <dd>
                  ${
                    classificationComplete
                      ? 'Complete'
                      : 'Review required'
                  }
                </dd>
              </div>

              <div>
                <dt>Shadow-posted entries</dt>
                <dd>Excluded</dd>
              </div>

              <div>
                <dt>Currency</dt>
                <dd>RWF</dd>
              </div>

              <div>
                <dt>As of date</dt>
                <dd>${escapeHtml(dateLabel(asOf))}</dd>
              </div>
            </dl>
          </article>

          <article class="aq-bs-panel">
            <h2>Financial Health</h2>

            <ul class="aq-bs-health">
              <li>
                <span>✓</span>
                Accounting equation
                ${
                  balanced
                    ? 'balanced'
                    : 'requires review'
                }
              </li>

              <li>
                <span>✓</span>
                Assets
                ${
                  totalAssets >= totalLiabilities
                    ? 'exceed'
                    : 'do not exceed'
                }
                liabilities
              </li>

              <li>
                <span>✓</span>
                Equity
                ${
                  totalEquity >= 0
                    ? 'positive'
                    : 'negative'
                }
              </li>
            </ul>
          </article>
        </aside>
      </section>

      <section
        class="aq-bs-monthly-support"
        data-aquila-balance-monthly-support="1"
      ></section>
    `;

    target.dataset.loaded =
      '1';

    target.dataset.asOf =
      String(asOf || '');

    /*
     * AQUILA_BALANCE_MONTHLY_MOUNT_R2_2
     *
     * Re-arm the existing Statement of Financial Position
     * renderer after every completed canonical Balance render.
     *
     * No route ownership.
     * No history mutation.
     * No cross-workspace rendering.
     */
    if (
      routeIsBalance()
      &&
      state?.current?.summary
      &&
      state?.current?.sections
    ) {
      window.setTimeout(
        () => {
          if (routeIsBalance()) {
            renderMonthlyPositionSupport();
          }
        },
        0
      );
    }
  }

  async function load(reason = 'load') {
    if (
      !routeIsBalance()
      ||
      state.loading
    ) {
      return;
    }

    state.loading =
      true;

    state.error =
      '';

    render();

    try {
      const current =
        await apiGet(
          state.asOf
        );

      let comparison =
        null;

      if (
        state.compareMode === 'custom'
        &&
        state.compareAsOf
      ) {
        comparison =
          await apiGet(
            state.compareAsOf
          );
      }

      state.current =
        current;

      state.comparison =
        comparison;

    } catch (error) {
      state.error =
        error instanceof Error
          ? error.message
          : String(error);

    } finally {
      state.loading =
        false;

      render();

      window.dispatchEvent(
        new CustomEvent(
          'ubuzima:finance-balance-canonical-rendered',
          {
            detail: {
              release:
                RELEASE,

              reason,

              asOf:
                state.asOf,
            }
          }
        )
      );
    }
  }

  function exportCsv() {
    const data =
      state.current;

    if (!data) {
      return;
    }

    const rows = [
      [
        'Section',
        'Account Code',
        'Account',
        'Balance',
      ],
    ];

    for (
      const key
      of [
        'assets',
        'liabilities',
        'equity',
      ]
    ) {
      const section =
        data?.sections?.[key];

      for (
        const row
        of (
          section?.rows
          || []
        )
      ) {
        rows.push([
          section?.label || key,
          row?.code || '',
          row?.name || '',
          number(row?.balance),
        ]);
      }
    }

    const csv =
      rows
        .map(
          row =>
            row
              .map(
                cell =>
                  '"'
                  +
                  String(cell)
                    .replace(/"/g, '""')
                  +
                  '"'
              )
              .join(',')
        )
        .join('\r\n');

    const blob =
      new Blob(
        [csv],
        {
          type:
            'text/csv;charset=utf-8',
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        'a'
      );

    anchor.href =
      url;

    anchor.download =
      `balance-sheet-${state.asOf}.csv`;

    document.body.appendChild(
      anchor
    );

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(
      url
    );
  }

  function delegateBackToFinance() {
    const controls =
      [
        ...document.querySelectorAll(
          'button,a,[role="button"]'
        ),
      ];

    const candidate =
      controls.find(
        element =>
          !root()?.contains(element)
          &&
          clean(element.textContent)
            .toLowerCase()
          === 'back to finance'
      );

    if (candidate) {
      candidate.click();
      return;
    }

    console.warn(
      '[Ubuzima+] Canonical Balance UI could not locate native Back to Finance control.'
    );
  }

  function onClick(event) {
    if (!routeIsBalance()) {
      return;
    }

    const target =
      event.target.closest(
        '[data-action]'
      );

    if (!target) {
      return;
    }

    const action =
      target.dataset.action;

    if (action === 'refresh') {
      void load(
        'refresh'
      );

      return;
    }

    if (action === 'export') {
      exportCsv();
      return;
    }

    if (action === 'back') {
      delegateBackToFinance();
      return;
    }

    if (action === 'toggle-section') {
      const key =
        target.dataset.section;

      if (
        key
        &&
        Object.prototype
          .hasOwnProperty
          .call(
            state.expanded,
            key
          )
      ) {
        state.expanded[key] =
          !state.expanded[key];

        render();
      }
    }
  }

  function onChange(event) {
    if (!routeIsBalance()) {
      return;
    }

    const target =
      event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const name =
      target.getAttribute(
        'name'
      );

    if (name === 'as-of') {
      state.asOf =
        target.value;

      void load(
        'as-of'
      );

      return;
    }

    if (name === 'compare-mode') {
      state.compareMode =
        target.value;

      if (
        state.compareMode === 'custom'
        &&
        !state.compareAsOf
      ) {
        state.compareAsOf =
          state.asOf;
      }

      if (
        state.compareMode === 'none'
      ) {
        state.comparison =
          null;
      }

      void load(
        'compare-mode'
      );

      return;
    }

    if (
      name === 'compare-as-of'
    ) {
      state.compareAsOf =
        target.value;

      if (
        state.compareMode === 'custom'
      ) {
        void load(
          'compare-date'
        );
      }
    }
  }

  function deactivate() {
    const target =
      root();

    if (target) {
      target.remove();
    }

    restoreNativeStatement();
  }

  function apply(reason = 'route') {
    if (!routeIsBalance()) {
      deactivate();
      return;
    }

    hideNativeStatement();

    const target =
      ensureRoot();

    if (!target) {
      return;
    }

    if (!state.current) {
      void load(reason);
    } else {
      render();
    }
  }

  const scheduleApply = reason => {
    [
      0,
      60,
      180,
      420,
      900,
      1800,
    ].forEach(
      delay => {
        window.setTimeout(
          () => apply(reason),
          delay
        );
      }
    );
  };

  document.addEventListener(
    'click',
    onClick
  );

  document.addEventListener(
    'change',
    onChange
  );

  window.addEventListener(
    'hashchange',
    () =>
      scheduleApply(
        'hashchange'
      )
  );

  window.addEventListener(
    'pageshow',
    () =>
      scheduleApply(
        'pageshow'
      )
  );

  window.addEventListener(
    'ubuzima:app-ready',
    () =>
      scheduleApply(
        'app-ready'
      )
  );

  if (
    document.readyState ===
      'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      () =>
        scheduleApply(
          'dom-ready'
        ),
      {
        once: true,
      }
    );
  } else {
    scheduleApply(
      'script-ready'
    );
  }

  window
    .__AQUILA_FINANCE_BALANCE_CANONICAL_UI__ = {
      release:
        RELEASE,

      refresh() {
        return load(
          'api-refresh'
        );
      },

      diagnose() {
        return {
          release:
            RELEASE,

          route:
            routeIsBalance(),

          root:
            Boolean(
              root()
            ),

          loaded:
            root()?.dataset.loaded
            === '1',

          asOf:
            state.asOf,

          error:
            state.error,
        };
      },
    };

  console.info(
    '[Ubuzima+] Balance Sheet canonical UI owner active.',
    RELEASE
  );

  /* ========================================================
   * AQUILA_BALANCE_MONTHLY_POSITION_R1_BEGIN
   *
   * Supporting presentation inside the canonical Balance UI.
   * Reuses the existing authoritative Balance Sheet API.
   * Does not own routing or the workspace lifecycle.
   * ======================================================== */

  const monthlyPositionCache =
    new Map();

  let monthlyPositionGeneration =
    0;

  function monthlyPositionDates(asOf) {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/
        .exec(
          String(asOf || '')
        );

    if (!match) {
      return [];
    }

    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const dates = [];

    for (
      let index = 1;
      index <= month;
      index += 1
    ) {
      if (index === month) {
        dates.push(asOf);
        continue;
      }

      const lastDay =
        new Date(
          Date.UTC(
            year,
            index,
            0
          )
        ).getUTCDate();

      dates.push(
        `${year}-${String(index).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      );
    }

    return dates;
  }

  function monthlyPositionLabel(iso) {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/
        .exec(
          String(iso || '')
        );

    if (!match) {
      return '';
    }

    const date =
      new Date(
        Date.UTC(
          Number(match[1]),
          Number(match[2]) - 1,
          1
        )
      );

    return new Intl.DateTimeFormat(
      'en',
      {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }
    )
      .format(date)
      .toUpperCase();
  }

  function monthlyPositionAccountValue(
    snapshot,
    definition
  ) {
    if (!snapshot) {
      return 0;
    }

    if (
      definition.kind ===
      'summary'
    ) {
      return number(
        snapshot?.summary?.[
          definition.key
        ]
      );
    }

    const sections =
      snapshot?.sections || {};

    const rows =
      [
        ...(sections.assets?.rows || []),
        ...(sections.liabilities?.rows || []),
        ...(sections.equity?.rows || []),
      ];

    const row =
      rows.find(
        item =>
          definition.accountId !== null
          &&
          Number(item?.account_id) ===
            Number(definition.accountId)
      )
      ||
      rows.find(
        item =>
          definition.code
          &&
          String(item?.code || '') ===
            definition.code
      );

    return number(
      row?.balance
    );
  }

  function monthlyPositionChart(
    chronological
  ) {
    if (
      !Array.isArray(chronological)
      ||
      chronological.length < 2
    ) {
      return `
        <div class="aq-bs-monthly-empty">
          Trend becomes available when at least two monthly positions exist.
        </div>
      `;
    }

    const series = [
      {
        name: 'Assets',
        className:
          'aq-bs-monthly-line-assets',
        values:
          chronological.map(
            item =>
              number(
                item.snapshot
                  ?.summary
                  ?.total_assets
              )
          ),
      },
      {
        name: 'Liabilities',
        className:
          'aq-bs-monthly-line-liabilities',
        values:
          chronological.map(
            item =>
              number(
                item.snapshot
                  ?.summary
                  ?.total_liabilities
              )
          ),
      },
      {
        name: 'Equity',
        className:
          'aq-bs-monthly-line-equity',
        values:
          chronological.map(
            item =>
              number(
                item.snapshot
                  ?.summary
                  ?.total_equity
              )
          ),
      },
    ];

    const values =
      series.flatMap(
        item => item.values
      );

    const maxValue =
      Math.max(
        1,
        ...values
          .map(
            value =>
              Math.abs(
                number(value)
              )
          )
      );

    const width = 960;
    const height = 220;
    const left = 34;
    const right = 24;
    const top = 22;
    const bottom = 34;

    const plotWidth =
      width - left - right;

    const plotHeight =
      height - top - bottom;

    const pointX = index =>
      left
      +
      (
        chronological.length <= 1
          ? plotWidth / 2
          : (
              index
              / (
                chronological.length - 1
              )
            )
            * plotWidth
      );

    const pointY = value =>
      top
      +
      (
        1
        -
        (
          Math.max(
            0,
            number(value)
          )
          /
          maxValue
        )
      )
      * plotHeight;

    const paths =
      series
        .map(
          item => {
            const points =
              item.values
                .map(
                  (value, index) =>
                    `${pointX(index).toFixed(2)},${pointY(value).toFixed(2)}`
                )
                .join(' ');

            return `
              <polyline
                class="${item.className}"
                points="${points}"
                fill="none"
                vector-effect="non-scaling-stroke"
              ></polyline>
            `;
          }
        )
        .join('');

    const labels =
      chronological
        .map(
          (item, index) => `
            <text
              x="${pointX(index).toFixed(2)}"
              y="${height - 9}"
              text-anchor="middle"
            >
              ${escapeHtml(
                monthlyPositionLabel(
                  item.date
                ).replace(
                  /\s+\d{4}$/,
                  ''
                )
              )}
            </text>
          `
        )
        .join('');

    return `
      <div class="aq-bs-monthly-chart-wrap">
        <div class="aq-bs-monthly-chart-legend">
          <span class="assets">
            <i></i>
            Assets
          </span>
          <span class="liabilities">
            <i></i>
            Liabilities
          </span>
          <span class="equity">
            <i></i>
            Equity
          </span>
        </div>

        <svg
          class="aq-bs-monthly-chart"
          viewBox="0 0 ${width} ${height}"
          role="img"
          aria-label="Monthly Balance Sheet position trend"
        >
          <line
            class="aq-bs-monthly-grid"
            x1="${left}"
            x2="${width - right}"
            y1="${top + plotHeight}"
            y2="${top + plotHeight}"
          ></line>

          ${paths}
          ${labels}
        </svg>
      </div>
    `;
  }

  async function renderMonthlyPositionSupport() {
    if (!routeIsBalance()) {
      return;
    }

    const host =
      document.querySelector(
        '[data-aquila-balance-monthly-support="1"]'
      );

    if (!host) {
      return;
    }

    const asOf =
      String(
        state?.current?.as_of
        ||
        state?.asOf
        ||
        ''
      ).slice(
        0,
        10
      );

    const dates =
      monthlyPositionDates(
        asOf
      );

    if (!dates.length) {
      host.innerHTML = '';
      return;
    }

    const generation =
      ++monthlyPositionGeneration;

    host.classList.add(
      'aq-bs-monthly-position-host'
    );

    host.innerHTML = `
      <section class="aq-bs-monthly-position">
        <div class="aq-bs-monthly-loading">
          Loading monthly financial position…
        </div>
      </section>
    `;

    const cacheKey =
      dates.join('|');

    let task =
      monthlyPositionCache.get(
        cacheKey
      );

    if (!task) {
      task =
        Promise.all(
          dates.map(
            async date => {
              if (
                date === asOf
                &&
                state?.current
                ?.summary
                &&
                state?.current
                ?.sections
              ) {
                return {
                  date,
                  snapshot:
                    state.current,
                };
              }

              try {
                return {
                  date,
                  snapshot:
                    await apiGet(
                      date
                    ),
                };
              } catch (error) {
                console.warn(
                  '[Ubuzima+] Monthly Balance snapshot could not be loaded.',
                  date,
                  error
                );

                return {
                  date,
                  snapshot:
                    null,
                };
              }
            }
          )
        );

      monthlyPositionCache.set(
        cacheKey,
        task
      );
    }

    const chronological =
      await task;

    if (
      generation !==
      monthlyPositionGeneration
      ||
      !host.isConnected
      ||
      !routeIsBalance()
    ) {
      return;
    }

    const usable =
      chronological.filter(
        item =>
          item?.snapshot
          &&
          item.snapshot.summary
          &&
          item.snapshot.sections
      );

    if (!usable.length) {
      host.innerHTML = `
        <section class="aq-bs-monthly-position">
          <div class="aq-bs-monthly-empty">
            Monthly financial position could not be loaded.
          </div>
        </section>
      `;
      return;
    }

    const current =
      usable[
        usable.length - 1
      ].snapshot;

    const currentAssets =
      Array.isArray(
        current
          ?.sections
          ?.assets
          ?.rows
      )
        ? current
            .sections
            .assets
            .rows
        : [];

    const focusAssets =
      currentAssets
        .filter(
          row =>
            Math.abs(
              number(
                row?.balance
              )
            ) > 0.0001
        )
        .sort(
          (left, right) =>
            Math.abs(
              number(
                right?.balance
              )
            )
            -
            Math.abs(
              number(
                left?.balance
              )
            )
        )
        .slice(
          0,
          3
        );

    const definitions = [
      ...focusAssets.map(
        row => ({
          kind:
            'account',
          accountId:
            row?.account_id
            ?? null,
          code:
            String(
              row?.code
              || ''
            ),
          label:
            String(
              row?.name
              || row?.code
              || 'Asset account'
            ),
        })
      ),
      {
        kind:
          'summary',
        key:
          'total_assets',
        label:
          'Total Assets',
        total:
          true,
      },
      {
        kind:
          'summary',
        key:
          'total_liabilities',
        label:
          'Total Liabilities',
        total:
          true,
      },
      {
        kind:
          'summary',
        key:
          'total_equity',
        label:
          'Total Equity',
        total:
          true,
      },
    ];

    /*
     * AQUILA_BALANCE_CASHFLOW_TABLE_STANDARD_R1
     *
     * Balance Sheet is point-in-time:
     * current = selected as-of month
     * previous = immediately preceding authoritative month
     * historical = earlier authoritative month-end positions
     */

    const currentMonthKey =
      String(
        asOf || ''
      ).slice(
        0,
        7
      );

    const previousPeriods =
      [...usable]
        .reverse()
        .filter(
          item =>
            String(
              item?.date || ''
            ).slice(
              0,
              7
            )
            !==
            currentMonthKey
        );

    const previousPeriod =
      previousPeriods[0]
      ||
      null;

    const historicalPeriods =
      previousPeriods.slice(
        1,
        7
      );

    const currentLabel =
      monthlyPositionLabel(
        asOf
      );

    const previousLabel =
      previousPeriod
        ?
        monthlyPositionLabel(
          previousPeriod.date
        )
        :
        'Previous Month';

    const historicalHeaders =
      historicalPeriods
        .map(
          item => `
            <th class="aq-bs-cf-historical">
              ${escapeHtml(
                monthlyPositionLabel(
                  item.date
                )
              )}
            </th>
          `
        )
        .join('');

    const monthlyChangePercent =
      value => {

        if (
          value === null
          ||
          value === undefined
          ||
          !Number.isFinite(
            Number(value)
          )
        ) {
          return '—';
        }

        return (
          Number(value)
            .toLocaleString(
              'en-RW',
              {
                minimumFractionDigits:
                  1,

                maximumFractionDigits:
                  1,
              }
            )
          +
          '%'
        );
      };

    const tableRows =
      definitions
        .map(
          definition => {

            const currentValue =
              monthlyPositionAccountValue(
                current,
                definition
              );

            const previousValue =
              previousPeriod
                ?
                monthlyPositionAccountValue(
                  previousPeriod.snapshot,
                  definition
                )
                :
                null;

            const currentNumber =
              number(
                currentValue
              );

            const previousNumber =
              previousValue === null
                ?
                null
                :
                number(
                  previousValue
                );

            const change =
              previousNumber === null
                ?
                null
                :
                currentNumber
                -
                previousNumber;

            const percentChange =
              (
                change === null
                ||
                previousNumber === null
              )
                ?
                null
                :
                (
                  previousNumber === 0
                    ?
                    (
                      currentNumber === 0
                        ?
                        0
                        :
                        null
                    )
                    :
                    (
                      change
                      /
                      Math.abs(
                        previousNumber
                      )
                      *
                      100
                    )
                );

            const historical =
              historicalPeriods
                .map(
                  item => `
                    <td class="aq-bs-cf-historical">
                      ${escapeHtml(
                        money(
                          monthlyPositionAccountValue(
                            item.snapshot,
                            definition
                          )
                        )
                      )}
                    </td>
                  `
                )
                .join('');

            return `
              <tr
                class="${
                  definition.total
                    ? 'aq-bs-monthly-total'
                    : ''
                }"
              >
                <th
                  scope="row"
                  class="aq-bs-cf-particulars"
                >
                  ${
                    definition.code
                      ? `
                        <span class="aq-bs-monthly-code">
                          ${escapeHtml(
                            definition.code
                          )}
                        </span>
                      `
                      : ''
                  }

                  <span>
                    ${escapeHtml(
                      definition.label
                    )}
                  </span>
                </th>

                <td class="aq-bs-cf-current">
                  ${escapeHtml(
                    money(
                      currentValue
                    )
                  )}
                </td>

                <td class="aq-bs-cf-previous">
                  ${
                    previousValue === null
                      ?
                      '—'
                      :
                      escapeHtml(
                        money(
                          previousValue
                        )
                      )
                  }
                </td>

                <td class="aq-bs-cf-change">
                  ${
                    change === null
                      ?
                      '—'
                      :
                      escapeHtml(
                        money(
                          change
                        )
                      )
                  }
                </td>

                <td class="aq-bs-cf-change-pct">
                  ${escapeHtml(
                    monthlyChangePercent(
                      percentChange
                    )
                  )}
                </td>

                ${historical}
              </tr>
            `;
          }
        )
        .join('');

    const year =
      asOf.slice(
        0,
        4
      );

    host.innerHTML = `
      <section
        class="aq-bs-monthly-position"
        aria-label="Statement of Financial Position monthly support"
      >
        <header class="aq-bs-monthly-header">
          <div>
            <h2>
              Balance Sheet
            </h2>

            <p>
              Monthly Actual Position
            </p>
          </div>

          <div class="aq-bs-monthly-actions">
            <span class="aq-bs-monthly-year">
              ${escapeHtml(year)}
            </span>

            <button
              type="button"
              class="aq-bs-monthly-trend-button"
              data-aquila-balance-monthly-trend-toggle="1"
              aria-expanded="false"
            >
              <span aria-hidden="true">
                ↗
              </span>
              View trend
            </button>
          </div>
        </header>

        <div class="aq-bs-monthly-table-scroll">
          <table class="aq-bs-monthly-table">
            <thead>
              <tr>
                
                <th class="aq-bs-cf-particulars">
                  Particulars
                </th>

                <th class="aq-bs-cf-current">
                  ${escapeHtml(currentLabel)}
                </th>

                <th class="aq-bs-cf-previous">
                  ${escapeHtml(previousLabel)}
                </th>

                <th class="aq-bs-cf-change">
                  Change
                </th>

                <th class="aq-bs-cf-change-pct">
                  % Change
                </th>

                ${historicalHeaders}

              </tr>
            </thead>

            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <div
          class="aq-bs-monthly-trend-panel"
          data-aquila-balance-monthly-trend-panel="1"
          hidden
        >
          ${monthlyPositionChart(
            usable
          )}
        </div>

        <p class="aq-bs-monthly-source-note">
          Current and historical monthly positions use the same authoritative posted-ledger Balance Sheet source.
        </p>
      </section>
    `;

    const toggle =
      host.querySelector(
        '[data-aquila-balance-monthly-trend-toggle="1"]'
      );

    const panel =
      host.querySelector(
        '[data-aquila-balance-monthly-trend-panel="1"]'
      );

    if (
      toggle
      &&
      panel
    ) {
      toggle.addEventListener(
        'click',
        () => {
          const show =
            panel.hidden;

          panel.hidden =
            !show;

          toggle.setAttribute(
            'aria-expanded',
            show
              ? 'true'
              : 'false'
          );

          toggle.innerHTML =
            show
              ? `
                <span aria-hidden="true">
                  ↘
                </span>
                Hide trend
              `
              : `
                <span aria-hidden="true">
                  ↗
                </span>
                View trend
              `;
        }
      );
    }
  }

  window.addEventListener(
    'ubuzima:finance-balance-canonical-rendered',
    () => {
      window.requestAnimationFrame(
        () => {
          renderMonthlyPositionSupport();
        }
      );
    }
  );

  /*
   * Handle direct entry where the canonical render may have
   * completed before this support block attaches.
   */
  window.setTimeout(
    () => {
      if (routeIsBalance()) {
        renderMonthlyPositionSupport();
      }
    },
    0
  );

  /* AQUILA_BALANCE_MONTHLY_POSITION_R1_END */


})();

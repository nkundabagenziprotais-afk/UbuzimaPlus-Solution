/* AQUILA_ACCOUNTING_CONTROL_CENTRE_REFERENCE_R8_4 */
(() => {
  'use strict';

  const OWNER =
    '__AQUILA_ACCOUNTING_CONTROL_CENTRE_REFERENCE_R8_4__';

  if (window[OWNER]) return;

  window[OWNER] = {
    version: 'r8.4',
    role: 'accounting-canonical-ui',
  };

  const NATIVE_SELECTOR = '.acct-workspace';
  const ROOT_SELECTOR =
    '[data-aquila-accounting-reference-ui="1"]';

  const NATIVE_ENGINE_ATTR =
    'data-aquila-accounting-native-engine';

  const EXTERNAL_FRAGMENT_ATTR =
    'data-aquila-accounting-native-fragment';

  let root = null;
  let nativeWorkspace = null;
  let nativeObserver = null;
  let scheduled = false;
  let lastSnapshotKey = '';
  let generation = 0;

  function clean(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function numberFrom(value) {
    const raw =
      String(value || '')
        .replace(/,/g, '')
        .replace(/[^\d().+-]/g, '');

    if (!raw) return null;

    const negative =
      raw.startsWith('(') &&
      raw.endsWith(')');

    const parsed =
      Number(
        raw.replace(/[()]/g, '')
      );

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return negative
      ? -parsed
      : parsed;
  }

  function routeParams() {
    const url =
      new URL(window.location.href);

    const merged =
      new URLSearchParams(
        url.search
      );

    const hash =
      new URLSearchParams(
        String(url.hash || '')
          .replace(/^#/, '')
      );

    for (
      const [key, value]
      of hash.entries()
    ) {
      merged.set(key, value);
    }

    return merged;
  }

  /*
   * AQUILA_ACCOUNTING_ROUTE_TRUTH_R8_1
   *
   * Main Finance remains the sole route owner.
   * Accounting presentation only reads the explicit route.
   * Native workspace visibility is never route truth.
   */
  function routeIsAccounting() {
    const params =
      routeParams();

    const section =
      lower(
        params.get('section')
      );

    const finance =
      lower(
        params.get('finance')
        ||
        params.get('workspace')
        ||
        params.get('page')
      );

    return (
      section === 'finance'
      &&
      finance === 'accounting'
    );
  }

  function workspaceScore(workspace) {
    let score = 0;

    if (
      workspace.querySelector(
        '.acct-kpis'
      )
    ) {
      score += 20;
    }

    if (
      workspace.querySelector(
        '.acct-overview-grid'
      )
    ) {
      score += 20;
    }

    if (
      workspace.querySelector(
        '.acct-card'
      )
    ) {
      score += 10;
    }

    if (
      /Accounting Overview/i.test(
        clean(workspace.textContent)
      )
    ) {
      score += 10;
    }

    if (
      workspace.offsetParent !== null
    ) {
      score += 5;
    }

    return score;
  }

  function nativeWorkspaces() {
    return Array.from(
      document.querySelectorAll(
        NATIVE_SELECTOR
      )
    ).filter(
      (workspace) =>
        !workspace.closest(
          ROOT_SELECTOR
        )
    );
  }

  function findNativeWorkspace() {
    const candidates =
      nativeWorkspaces();

    if (!candidates.length) {
      return null;
    }

    return candidates
      .sort(
        (left, right) =>
          workspaceScore(right)
          -
          workspaceScore(left)
      )[0];
  }

  function findMountAnchor() {
    const workspaces =
      nativeWorkspaces();

    return (
      workspaces[0]
      ||
      null
    );
  }

  function markNativeEngines() {
    nativeWorkspaces()
      .forEach(
        (workspace) => {
          workspace.setAttribute(
            NATIVE_ENGINE_ATTR,
            '1'
          );

          workspace.setAttribute(
            'aria-hidden',
            'true'
          );
        }
      );
  }

  function nativeDocuments() {
    const docs = [document];

    document
      .querySelectorAll('iframe')
      .forEach(
        (frame) => {
          try {
            if (
              frame.contentDocument
            ) {
              docs.push(
                frame.contentDocument
              );
            }
          } catch (_) {
            // Cross-origin frame.
          }
        }
      );

    return docs;
  }

  function allNativeControls() {
    return nativeDocuments()
      .flatMap(
        (doc) =>
          Array.from(
            doc.querySelectorAll(
              'button,a,[role="button"],[role="tab"]'
            )
          )
      )
      .filter(
        (control) =>
          !control.closest(
            ROOT_SELECTOR
          )
      );
  }

  /*
   * AQUILA_ACCOUNTING_EXPLICIT_ACTION_OWNERS_R8_1
   *
   * Do not use the first matching label in the entire app.
   * Priority:
   * 1. dedicated support owner where applicable;
   * 2. native Accounting workspace;
   * 3. global navigation/deck;
   * 4. unique exact system control only.
   */

  function controlsInside(scope) {
    if (
      !scope
      ||
      !scope.querySelectorAll
    ) {
      return [];
    }

    return Array.from(
      scope.querySelectorAll(
        'button,a,[role="button"],[role="tab"]'
      )
    ).filter(
      (control) =>
        !control.closest(
          ROOT_SELECTOR
        )
    );
  }

  function exactControl(
    controls,
    labels
  ) {
    for (const label of labels) {
      const match =
        controls.find(
          (control) =>
            clean(
              control.textContent
            ) === label
        );

      if (match) {
        return match;
      }
    }

    return null;
  }

  function controlDescriptor(control) {
    const parts = [];

    let current =
      control;

    for (
      let depth = 0;
      depth < 4 && current;
      depth += 1
    ) {
      if (current.id) {
        parts.push(
          current.id
        );
      }

      if (
        typeof current.className
        === 'string'
      ) {
        parts.push(
          current.className
        );
      }

      if (current.attributes) {
        Array.from(
          current.attributes
        ).forEach(
          (attribute) => {
            if (
              attribute.name.startsWith(
                'data-'
              )
            ) {
              parts.push(
                attribute.name
              );

              parts.push(
                attribute.value
              );
            }
          }
        );
      }

      current =
        current.parentElement;
    }

    return lower(
      parts.join(' ')
    );
  }

  function controlVisible(control) {
    if (!control) {
      return false;
    }

    const view =
      control.ownerDocument
        ?.defaultView
      ||
      window;

    const style =
      view.getComputedStyle(
        control
      );

    const rect =
      control.getBoundingClientRect();

    return (
      rect.width > 0
      &&
      rect.height > 0
      &&
      style.display !== 'none'
      &&
      style.visibility !== 'hidden'
    );
  }

  function navigationControl(labels) {
    const wanted =
      labels
        .map(clean)
        .filter(Boolean);

    const selectors = [
      'nav button',
      'nav a',
      '[role="navigation"] button',
      '[role="navigation"] a',
      '[data-workspace-module-key]',
      '[data-direct-page]',
      '[data-finance-route]',
      '[data-route]',
      '[data-workspace]',
    ].join(',');

    const controls =
      Array.from(
        document.querySelectorAll(
          selectors
        )
      )
      .filter(
        (control) =>
          !control.closest(
            ROOT_SELECTOR
          )
      );

    /*
     * Exact visible destination first.
     */
    for (const label of wanted) {
      const visible =
        controls.find(
          (control) =>
            controlVisible(
              control
            )
            &&
            clean(
              control.textContent
            ) === label
        );

      if (visible) {
        return visible;
      }
    }

    /*
     * Exact existing destination second.
     */
    for (const label of wanted) {
      const exact =
        controls.find(
          (control) =>
            clean(
              control.textContent
            ) === label
        );

      if (exact) {
        return exact;
      }
    }

    return null;
  }

  /*
   * AQUILA_ACCOUNTING_BACK_TO_FINANCE_R8_2_1
   *
   * Use Main Finance's native Accounting Back control first.
   * Canonical Accounting does not write any route.
   */
  /*
   * AQUILA_ACCOUNTING_BACK_EXACT_R8_3
   *
   * AccountingWorkspace already owns:
   *
   * onBack={() => setActiveFinanceWorkspace('overview')}
   *
   * Find that React control even when its visible text includes
   * the leading arrow.
   */
  /*
   * AQUILA_ACCOUNTING_BACK_RUNTIME_TRUTH_R8_4
   *
   * Main Finance React state owns the transition:
   * Accounting -> overview.
   *
   * Canonical Accounting watches for the native Accounting
   * workspace to disappear and then tears itself down.
   */
  function openFinanceOverview() {
    const workspace =
      findNativeWorkspace();

    if (!workspace) {
      teardown();
      return true;
    }

    const normalizeBackLabel =
      (value) =>
        clean(value)
          .replace(
            /^[←‹«]\s*/,
            ''
          )
          .trim();

    const nativeBack =
      controlsInside(
        workspace
      ).find(
        (control) => {
          const values = [
            control.textContent,
            control.getAttribute(
              'aria-label'
            ),
            control.getAttribute(
              'title'
            ),
          ];

          return values.some(
            (value) =>
              /^Back to Finance$/i.test(
                normalizeBackLabel(
                  value
                )
              )
          );
        }
      )
      ||
      null;

    if (
      !nativeBack
      ||
      nativeControlDisabled(
        nativeBack
      )
    ) {
      showToast(
        'The existing Back to Finance control is unavailable.'
      );

      return false;
    }

    try {
      nativeBack.click();
    } catch (_) {
      showToast(
        'Back to Finance could not be opened.'
      );

      return false;
    }

    let attempts = 0;

    const settle =
      () => {
        attempts += 1;

        /*
         * This is the real browser/runtime truth.
         *
         * Main Finance changing activeFinanceWorkspace to
         * overview unmounts the native Accounting workspace.
         */
        if (
          !findNativeWorkspace()
        ) {
          teardown();
          return;
        }

        if (
          attempts < 20
        ) {
          window.setTimeout(
            settle,
            50
          );

          return;
        }

        /*
         * Do not invent another route owner.
         */
        showToast(
          'Main Finance did not leave Accounting.'
        );
      };

    window.setTimeout(
      settle,
      0
    );

    return true;
  }

  /*
   * AQUILA_QB1_MODULE_ACTIVATION_R1_2
   *
   * Prefer an enabled existing workflow owner.
   *
   * This is action discovery only:
   * - no route ownership
   * - no workflow rewrite
   * - no synthetic click interception
   */
  function findNativeControl(labels) {
    const wanted =
      labels
        .map(clean)
        .filter(Boolean);


    /*
     * AQUILA_ACCOUNTING_FINAL_THREE_ACTIVATION_R3
     *
     * The bridge below owns NO route and renders NO visible UI.
     *
     * It exists only to hand the canonical button to the already
     * established workflow owner for:
     *
     * - Fixed Assets
     * - Landed Cost
     * - New Journal Entry
     */
    const activationKey =
      lower(
        wanted[0]
        ||
        ''
      );

    const activationOwners = {
      'fixed assets':
        'fixed-assets',

      'landed cost':
        'landed-cost',

      'new journal entry':
        'new-journal-entry',
    };

    const activationOwnerKey =
      activationOwners[
        activationKey
      ];

    if (activationOwnerKey) {
      const activationOwner =
        document.querySelector(
          '[data-aquila-accounting-action-owner="'
          + activationOwnerKey
          + '"]'
        );

      if (activationOwner) {
        return activationOwner;
      }
    }

    const controls =
      allNativeControls();

    const key =
      lower(
        wanted[0]
        ||
        ''
      );

    /*
     * Preserve Pharmacy Advanced COA's existing F3 owner.
     */
    if (
      key ===
      'pharmacy advanced coa'
    ) {
      const launcher =
        document.getElementById(
          'aquila-finance-f3-r4-3-r4-native-launcher'
        );

      if (launcher) {
        return launcher;
      }
    }

    const enabled =
      (control) =>
        Boolean(
          control
          &&
          !nativeControlDisabled(
            control
          )
        );

    /*
     * PASS 1 — enabled exact match.
     */
    for (const label of wanted) {
      const match =
        controls.find(
          (control) =>
            clean(
              control.textContent
            ) === label
            &&
            enabled(
              control
            )
        );

      if (match) {
        return match;
      }
    }

    /*
     * PASS 2 — enabled partial match.
     */
    for (const label of wanted) {
      const wantedLower =
        lower(
          label
        );

      const match =
        controls.find(
          (control) =>
            lower(
              control.textContent
            ).includes(
              wantedLower
            )
            &&
            enabled(
              control
            )
        );

      if (match) {
        return match;
      }
    }

    /*
     * PASS 3 — exact fallback.
     *
     * A genuinely policy-disabled native action remains disabled.
     */
    for (const label of wanted) {
      const match =
        controls.find(
          (control) =>
            clean(
              control.textContent
            ) === label
        );

      if (match) {
        return match;
      }
    }

    /*
     * PASS 4 — partial fallback.
     */
    for (const label of wanted) {
      const wantedLower =
        lower(
          label
        );

      const match =
        controls.find(
          (control) =>
            lower(
              control.textContent
            ).includes(
              wantedLower
            )
        );

      if (match) {
        return match;
      }
    }

    return null;
  }


  /*
   * AQUILA_ACCOUNTING_SUBMODULE_RECOVERY_R2
   *
   * Workflow availability is semantic, not visual.
   * Hidden native support controls may remain valid workflow owners.
   */
  function nativeControlDisabled(control) {
    if (!control) {
      return true;
    }

    if (
      control.disabled
      ===
      true
    ) {
      return true;
    }

    const ariaDisabled =
      lower(
        control.getAttribute?.(
          'aria-disabled'
        )
        ||
        ''
      );

    if (
      ariaDisabled
      ===
      'true'
    ) {
      return true;
    }

    const dataDisabled =
      lower(
        control.getAttribute?.(
          'data-disabled'
        )
        ||
        ''
      );

    if (
      dataDisabled === 'true'
      ||
      dataDisabled === '1'
    ) {
      return true;
    }

    if (
      control.matches?.(
        '[disabled],.is-disabled,.disabled'
      )
    ) {
      return true;
    }

    return false;
  }


  function nativeDataState(workspace) {
    if (!workspace) {
      return {
        state: 'missing',
        message:
          'Accounting data source is unavailable.',
      };
    }

    const message =
      clean(
        workspace
          .querySelector(
            '.acct-message'
          )
          ?.textContent
      );

    if (
      /loading live accounting data/i.test(
        message
      )
    ) {
      return {
        state: 'loading',
        message:
          'Loading live Accounting data…',
      };
    }

    if (
      /could not be loaded/i.test(
        message
      )
    ) {
      return {
        state: 'error',
        message:
          message
          ||
          'Accounting data could not be loaded.',
      };
    }

    if (
      workspace.querySelector(
        '.acct-kpis'
      )
    ) {
      return {
        state: 'ready',
        message: '',
      };
    }

    return {
      state: 'pending',
      message:
        message
        ||
        'Waiting for live Accounting data…',
    };
  }

  /*
   * AQUILA_ACCOUNTING_SINGLE_PRESENTATION_R8_2_1
   */
  function enforceSinglePresentation() {
    if (!root) {
      return;
    }

    /*
     * Exactly one canonical Accounting presentation.
     */
    Array.from(
      document.querySelectorAll(
        ROOT_SELECTOR
      )
    ).forEach(
      (candidate) => {
        if (
          candidate
          !== root
        ) {
          candidate.remove();
        }
      }
    );

    /*
     * Native Accounting remains hidden data/action support.
     */
    nativeWorkspaces()
      .forEach(
        (workspace) => {
          workspace.setAttribute(
            NATIVE_ENGINE_ATTR,
            '1'
          );

          workspace.setAttribute(
            'aria-hidden',
            'true'
          );
        }
      );

    /*
     * Remove ONLY the Pharmacy Advanced COA HEADER card.
     *
     * Header card contains subtitle text, therefore use
     * startsWith(), not exact equality.
     *
     * Preserve Pharmacy Advanced COA in Quick Actions.
     */
    Array.from(
      root.querySelectorAll(
        'button,a,[role="button"],[role="tab"]'
      )
    ).forEach(
      (control) => {
        const label =
          clean(
            control.textContent
          );

        if (
          !label.startsWith(
            'Pharmacy Advanced COA'
          )
        ) {
          return;
        }

        /*
         * Approved Quick Actions card stays.
         */
        if (
          control.closest(
            '.aq-acc-quick-grid'
          )
        ) {
          return;
        }

        /*
         * Any Pharmacy Advanced COA control elsewhere inside
         * canonical Accounting is the unwanted header card.
         */
        control.remove();
      }
    );

    document.documentElement.setAttribute(
      'data-aquila-accounting-visible-ui-count',
      String(
        document.querySelectorAll(
          ROOT_SELECTOR
        ).length
      )
    );
  }


  /*
   * Keep existing Landed Cost native owners alive but invisible.
   * The canonical Quick Action is the single presentation.
   */
  function markDuplicateQuickActionOwners() {
    const nativeControls =
      allNativeControls();

    nativeControls
      .forEach(
        (control) => {
          const label =
            clean(
              control.textContent
            );

          if (
            /^Landed Cost$/i.test(
              label
            )
          ) {
            control.setAttribute(
              'data-aquila-accounting-hidden-action-owner',
              'landed-cost'
            );

            control.setAttribute(
              'data-aquila-accounting-workflow-owner',
              'preserved'
            );
          }
        }
      );

    if (!root) {
      return;
    }

    /*
     * If another presentation asset injected a Landed Cost
     * control into the canonical visual area, hide that injected
     * control but retain the real canonical data-native-action.
     */
    Array.from(
      root.querySelectorAll(
        'button,a,[role="button"]'
      )
    )
      .forEach(
        (control) => {
          const label =
            clean(
              control.textContent
            );

          if (
            !/^Landed Cost$/i.test(
              label
            )
          ) {
            return;
          }

          if (
            control.hasAttribute(
              'data-native-action'
            )
          ) {
            return;
          }

          control.setAttribute(
            'data-aquila-accounting-hidden-action-owner',
            'landed-cost'
          );
        }
      );
  }

  /*
   * Action availability is independent of the Overview data-loader
   * state. Each action follows its own existing workflow owner.
   */
  function syncActionAvailability() {
    if (!root) {
      return;
    }

    markDuplicateQuickActionOwners();

    const actions =
      Array.from(
        root.querySelectorAll(
          '[data-native-action]'
        )
      );

    let availableCount = 0;

    actions
      .forEach(
        (button) => {
          const raw =
            button.getAttribute(
              'data-native-action'
            )
            ||
            '';

          const labels =
            raw
              .split('|')
              .map(clean)
              .filter(Boolean);

          const control =
            labels.length
              ? findNativeControl(
                  labels
                )
              : null;

          const disabled =
            !control
            ||
            nativeControlDisabled(
              control
            );

          button.disabled =
            disabled;

          button.setAttribute(
            'aria-disabled',
            disabled
              ? 'true'
              : 'false'
          );

          button.classList.toggle(
            'is-disabled',
            disabled
          );

          if (!disabled) {
            availableCount += 1;
          }
        }
      );

    root.setAttribute(
      'data-aquila-accounting-actions-ready',
      availableCount > 0
        ? '1'
        : '0'
    );

    root.setAttribute(
      'data-aquila-accounting-available-action-count',
      String(
        availableCount
      )
    );
  }



  const ACCOUNTING_NATIVE_SUBMODULE_ACTIONS_R2 =
    new Set([
      'new journal entry',
      'journal register',
      'general ledger',
      'trial balance',
      'chart of accounts',
      'pharmacy advanced coa',
      'fixed assets',
      'landed cost',
      'account mappings',
      'business dates',
      'accounting periods',
      'control readiness',
    ]);

  function accountingActionKey(labels) {
    return lower(
      labels?.[0]
      ||
      ''
    );
  }

  function isAccountingSubmoduleAction(labels) {
    return (
      ACCOUNTING_NATIVE_SUBMODULE_ACTIONS_R2
        .has(
          accountingActionKey(
            labels
          )
        )
    );
  }

  function leaveAccountingSubmoduleMode() {
    document.documentElement
      .removeAttribute(
        'data-aquila-accounting-submodule-active'
      );

    nativeWorkspaces()
      .forEach(
        (workspace) => {
          workspace.removeAttribute(
            'data-aquila-accounting-submodule-active'
          );

          workspace.removeAttribute(
            'data-aquila-accounting-submodule-key'
          );
        }
      );

    if (root) {
      root.hidden = false;

      root.removeAttribute(
        'data-aquila-accounting-overview-suspended'
      );
    }
  }

  function enterAccountingSubmoduleMode(labels) {
    const key =
      accountingActionKey(
        labels
      );

    const workspace =
      findNativeWorkspace();

    document.documentElement
      .setAttribute(
        'data-aquila-accounting-submodule-active',
        key
        ||
        'accounting-submodule'
      );

    if (root) {
      root.hidden = true;

      root.setAttribute(
        'data-aquila-accounting-overview-suspended',
        '1'
      );
    }

    if (!workspace) {
      return;
    }

    workspace.setAttribute(
      'data-aquila-accounting-submodule-active',
      '1'
    );

    workspace.setAttribute(
      'data-aquila-accounting-submodule-key',
      key
      ||
      'accounting-submodule'
    );

    workspace.removeAttribute(
      'aria-hidden'
    );

    /*
     * Observe native Back-to-Accounting controls without
     * intercepting or replacing their native click behaviour.
     */
    if (
      workspace.getAttribute(
        'data-aquila-accounting-r2-exit-listener'
      )
      !==
      '1'
    ) {
      workspace.setAttribute(
        'data-aquila-accounting-r2-exit-listener',
        '1'
      );

      workspace.addEventListener(
        'click',
        (event) => {
          const control =
            event.target.closest(
              'button,a,[role="button"],[role="tab"]'
            );

          if (!control) {
            return;
          }

          const label =
            lower(
              clean(
                control.textContent
              )
            );

          if (
            label === 'accounting overview'
            ||
            label.includes(
              'back to accounting'
            )
          ) {
            leaveAccountingSubmoduleMode();

            window.setTimeout(
              () => {
                schedule(
                  'submodule-native-return'
                );
              },
              0
            );
          }
        }
      );
    }
  }

  /*
   * Delegate to the existing native/system owner.
   *
   * Crucially:
   * do not immediately schedule a canonical Overview render
   * after launching an Accounting submodule.
   */
  function triggerNative(labels) {
    const control =
      findNativeControl(
        labels
      );

    if (!control) {
      showToast(
        'This Accounting workspace is not available in the current system state.'
      );

      return false;
    }

    if (
      nativeControlDisabled(
        control
      )
    ) {
      showToast(
        'This Accounting action is currently unavailable.'
      );

      return false;
    }

    const submodule =
      isAccountingSubmoduleAction(
        labels
      );

    if (submodule) {
      enterAccountingSubmoduleMode(
        labels
      );
    }

    control.click();

    if (submodule) {
      window.setTimeout(
        () => {
          const workspace =
            findNativeWorkspace();

          if (workspace) {
            workspace.setAttribute(
              'data-aquila-accounting-submodule-active',
              '1'
            );

            workspace.removeAttribute(
              'aria-hidden'
            );
          }

          if (root) {
            root.hidden = true;

            root.setAttribute(
              'data-aquila-accounting-overview-suspended',
              '1'
            );
          }

          markDuplicateQuickActionOwners();
        },
        120
      );

      return true;
    }

    window.setTimeout(
      () => {
        syncActionAvailability();

        schedule(
          'native-action'
        );
      },
      120
    );

    return true;
  }


  function elementsByText(
    container,
    label
  ) {
    const target =
      lower(label);

    return Array.from(
      container.querySelectorAll(
        'span,p,div,strong,small,h1,h2,h3,h4,h5,label'
      )
    ).filter(
      (element) => {
        const text =
          lower(
            element.textContent
          );

        return (
          text === target
          ||
          text.startsWith(
            target + ' '
          )
        );
      }
    );
  }

  function closestPanel(element) {
    return (
      element.closest(
        'article,section,[class*="card"],[class*="panel"],[class*="kpi"]'
      )
      ||
      element.parentElement
    );
  }

  function valueNear(label) {
    if (!nativeWorkspace) {
      return '—';
    }

    const matches =
      elementsByText(
        nativeWorkspace,
        label
      );

    for (const match of matches) {
      const panel =
        closestPanel(match);

      if (!panel) continue;

      const candidates =
        Array.from(
          panel.querySelectorAll(
            'strong,[class*="value"],[class*="amount"],[class*="total"]'
          )
        )
        .map(
          (element) =>
            clean(
              element.textContent
            )
        )
        .filter(
          (text) =>
            text
            &&
            lower(text)
            !== lower(label)
            &&
            text.length < 90
        );

      if (candidates.length) {
        return candidates[0];
      }
    }

    return '—';
  }

  function statusNear(label) {
    if (!nativeWorkspace) {
      return '—';
    }

    const matches =
      elementsByText(
        nativeWorkspace,
        label
      );

    for (const match of matches) {
      const panel =
        closestPanel(match);

      if (!panel) continue;

      const text =
        clean(
          panel.textContent
        );

      if (
        /\bBalanced\b/i.test(text)
      ) {
        return 'Balanced';
      }

      if (
        /\bOpen\b/i.test(text)
      ) {
        return 'Open';
      }
    }

    return '—';
  }

  function findPanel(labels) {
    if (!nativeWorkspace) {
      return null;
    }

    for (const label of labels) {
      const matches =
        elementsByText(
          nativeWorkspace,
          label
        );

      for (const match of matches) {
        const panel =
          closestPanel(match);

        if (panel) {
          return panel;
        }
      }
    }

    return null;
  }

  function tableRows(
    panel,
    maxRows = 8
  ) {
    if (!panel) {
      return [];
    }

    const rows =
      Array.from(
        panel.querySelectorAll(
          'tbody tr'
        )
      );

    if (rows.length) {
      return rows
        .slice(0, maxRows)
        .map(
          (row) =>
            Array.from(
              row.querySelectorAll(
                'th,td'
              )
            )
            .map(
              (cell) =>
                clean(
                  cell.textContent
                )
            )
            .filter(Boolean)
        )
        .filter(
          (cells) =>
            cells.length
        );
    }

    const alternatives =
      Array.from(
        panel.querySelectorAll(
          'li,[class*="row"]'
        )
      );

    const result = [];

    for (const row of alternatives) {
      if (
        result.length >= maxRows
      ) {
        break;
      }

      if (
        row.querySelector(
          'table'
        )
      ) {
        continue;
      }

      const direct =
        Array.from(
          row.children
        )
        .map(
          (child) =>
            clean(
              child.textContent
            )
        )
        .filter(
          (text) =>
            text
            &&
            text.length < 120
        );

      if (
        direct.length >= 2
        &&
        direct.length <= 8
      ) {
        result.push(direct);
      }
    }

    return result;
  }

  function panelMessage(labels) {
    const panel =
      findPanel(labels);

    if (!panel) {
      return '';
    }

    const headingSet =
      labels.map(lower);

    const pieces =
      Array.from(
        panel.querySelectorAll(
          'p,small,span,strong'
        )
      )
      .map(
        (element) =>
          clean(
            element.textContent
          )
      )
      .filter(
        (text) =>
          text
          &&
          text.length < 180
          &&
          !headingSet.includes(
            lower(text)
          )
      );

    return pieces[0] || '';
  }

  function recentJournalRows() {
    if (!nativeWorkspace) {
      return [];
    }

    const tables =
      Array.from(
        nativeWorkspace.querySelectorAll(
          'table'
        )
      );

    const table =
      tables.find(
        (candidate) => {
          const text =
            lower(
              candidate.textContent
            );

          return (
            text.includes('journal')
            &&
            (
              text.includes('debit')
              ||
              text.includes('credit')
            )
          );
        }
      );

    if (!table) {
      return [];
    }

    return Array.from(
      table.querySelectorAll(
        'tbody tr'
      )
    )
      .slice(0, 8)
      .map(
        (row) =>
          Array.from(
            row.querySelectorAll(
              'td'
            )
          )
          .map(
            (cell) =>
              clean(
                cell.textContent
              )
          )
      )
      .filter(
        (cells) =>
          cells.length
      );
  }

  function taskRows() {
    const panel =
      findPanel([
        'Key Tasks',
        'Control attention',
      ]);

    const rows =
      tableRows(panel, 4);

    if (rows.length) {
      return rows;
    }

    const labels = [
      'Shadow journals awaiting recognition policy',
      'MoMo reconciliation items needing review',
      'Accounting period configuration',
    ];

    return labels
      .map(
        (label) => {
          const value =
            valueNear(label);

          if (
            value === '—'
          ) {
            return null;
          }

          return [
            label,
            value,
          ];
        }
      )
      .filter(Boolean);
  }

  function snapshot() {
    const income =
      valueNear('Income');

    const expenses =
      valueNear('Expenses');

    const netIncome =
      valueNear('Net income');

    const cash =
      valueNear(
        'Cash & MoMo balance'
      );

    const receivables =
      valueNear('Receivables');

    const payables =
      valueNear('Payables');

    const equation =
      statusNear(
        'Accounting equation'
      );

    const netMargin =
      valueNear('Net margin');

    const incomeNumber =
      numberFrom(income);

    const expenseNumber =
      numberFrom(expenses);

    let chartDegrees = 355;

    if (
      incomeNumber !== null
      &&
      expenseNumber !== null
      &&
      Math.abs(incomeNumber)
      +
      Math.abs(expenseNumber)
      > 0
    ) {
      chartDegrees =
        Math.max(
          4,
          Math.min(
            356,
            (
              Math.abs(incomeNumber)
              /
              (
                Math.abs(incomeNumber)
                +
                Math.abs(expenseNumber)
              )
            )
            *
            360
          )
        );
    }

    return {
      netIncome,
      cash,
      receivables,
      payables,
      equation,
      income,
      expenses,
      netMargin,
      chartDegrees,

      balances:
        tableRows(
          findPanel([
            'Account Balance Summary',
            'Key accounts',
          ]),
          8
        ),

      expenseRows:
        tableRows(
          findPanel([
            'Expenses by Category',
            'Ledger expense accounts',
          ]),
          7
        ),

      journals:
        recentJournalRows(),

      tasks:
        taskRows(),

      reconciliation:
        panelMessage([
          'Cash & MoMo Reconciliation',
          'System totals',
        ]),

      period:
        panelMessage([
          'Accounting Period',
          'Current control window',
        ]),

      insight:
        panelMessage([
          'Accounting Insight',
          'Current note',
        ]),
    };
  }

  function icon(name) {
    const icons = {
      trend: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 17l5-5 4 4 7-9"></path>
          <path d="M15 7h5v5"></path>
        </svg>
      `,

      wallet: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h14a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2V7z"></path>
          <path d="M4 8V6a2 2 0 0 1 2-2h11"></path>
          <path d="M15 12h6v4h-6z"></path>
        </svg>
      `,

      person: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3"></circle>
          <path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6"></path>
        </svg>
      `,

      card: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2"></rect>
          <path d="M3 10h18"></path>
          <path d="M7 15h5"></path>
        </svg>
      `,

      scale: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v18"></path>
          <path d="M7 5h10"></path>
          <path d="M5 8l-3 6h6L5 8z"></path>
          <path d="M19 8l-3 6h6l-3-6z"></path>
          <path d="M8 21h8"></path>
        </svg>
      `,

      book: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4z"></path>
          <path d="M20 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h6z"></path>
        </svg>
      `,

      plus: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14"></path>
        </svg>
      `,

      lock: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="10" width="14" height="10" rx="2"></rect>
          <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
        </svg>
      `,

      grid: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="6" height="6" rx="1"></rect>
          <rect x="14" y="4" width="6" height="6" rx="1"></rect>
          <rect x="4" y="14" width="6" height="6" rx="1"></rect>
          <rect x="14" y="14" width="6" height="6" rx="1"></rect>
        </svg>
      `,
    };

    return icons[name] || icons.book;
  }

  function rowHtml(
    row,
    className = ''
  ) {
    const first =
      escapeHtml(
        row[0] || '—'
      );

    const last =
      escapeHtml(
        row[
          row.length - 1
        ] || ''
      );

    const middle =
      row
        .slice(1, -1)
        .map(escapeHtml)
        .join(' · ');

    return `
      <div class="aq-acc-list-row ${className}">
        <div class="aq-acc-list-main">
          <strong>${first}</strong>
          ${
            middle
              ? `<span>${middle}</span>`
              : ''
          }
        </div>
        <span class="aq-acc-list-value">${last}</span>
      </div>
    `;
  }

  function rowsOrEmpty(
    rows,
    message
  ) {
    if (
      !Array.isArray(rows)
      ||
      !rows.length
    ) {
      return `
        <div class="aq-acc-empty">
          ${escapeHtml(message)}
        </div>
      `;
    }

    return rows
      .map(
        (row) =>
          rowHtml(row)
      )
      .join('');
  }

  function journalsHtml(rows) {
    if (
      !Array.isArray(rows)
      ||
      !rows.length
    ) {
      return `
        <div class="aq-acc-empty aq-acc-empty--table">
          No recent journal rows are available from the live Accounting workspace.
        </div>
      `;
    }

    const normalized =
      rows.map(
        (cells) => {
          const padded =
            [...cells];

          while (
            padded.length < 6
          ) {
            padded.push('');
          }

          return padded;
        }
      );

    return `
      <div class="aq-acc-table-wrap">
        <table class="aq-acc-table">
          <thead>
            <tr>
              <th>Journal</th>
              <th>Business date</th>
              <th>Source</th>
              <th>Status</th>
              <th>Debit</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            ${
              normalized
                .map(
                  (cells) => `
                    <tr>
                      <td>${escapeHtml(cells[0])}</td>
                      <td>${escapeHtml(cells[1])}</td>
                      <td>${escapeHtml(cells[2])}</td>
                      <td>
                        <span class="aq-acc-status">
                          ${escapeHtml(cells[3])}
                        </span>
                      </td>
                      <td>${escapeHtml(cells[cells.length - 2])}</td>
                      <td>${escapeHtml(cells[cells.length - 1])}</td>
                    </tr>
                  `
                )
                .join('')
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function canonicalMarkup(data) {


    const quick = [
      ['Journal Register', 'Journal Register'],
      ['General Ledger', 'General Ledger'],
      ['Trial Balance', 'Trial Balance'],
      ['Chart of Accounts', 'Chart of Accounts'],
      ['Pharmacy Advanced COA', 'Pharmacy Advanced COA'],
      ['Fixed Assets', 'Fixed Assets'],
      ['Landed Cost', 'Landed Cost'],
      ['Account Mappings', 'Account Mappings'],
      ['Business Dates', 'Business Dates'],
      ['Accounting Periods', 'Accounting Periods'],
      ['Control Readiness', 'Control Readiness'],
    ];

    const reconciliation =
      data.reconciliation
      ||
      'No payment totals are available from the current live Accounting workspace.';

    const period =
      data.period
      ||
      'Current Accounting period information is not available.';

    const insight =
      data.insight
      ||
      'No current Accounting control note is available.';

    return `
      <div class="aq-acc-layout">
<main class="aq-acc-main">

          <div class="aq-acc-back-row">
            <button
              type="button"
              class="aq-acc-back"
              data-native-action="Back to Finance|Finance overview|Finance"
            >
              ←&nbsp;&nbsp; Back to Finance
            </button>
          </div>

          <header class="aq-acc-header">
            <div class="aq-acc-title-block">
              <span class="aq-acc-eyebrow">
                ACCOUNTING CONTROL CENTRE
              </span>

              <h1>
                Accounting Overview
              </h1>

              <p>
                Review the live ledger, Business Dates, mappings,
                reconciliation signals, periods and journal activity
                without changing original Sales or payments.
              </p>
            </div>

            <div class="aq-acc-header-actions">

              <button
                type="button"
                class="aq-acc-action aq-acc-action--primary"
                data-native-action="New Journal Entry"
              >
                <span class="aq-acc-action-icon">
                  ${icon('plus')}
                </span>
                New Journal Entry
              </button>

              <button
                type="button"
                class="aq-acc-action"
                data-native-action="Close Books|Open Close Books"
              >
                <span class="aq-acc-action-icon">
                  ${icon('lock')}
                </span>
                Close Books
              </button>

              <button
                type="button"
                class="aq-acc-action"
                data-native-action="Main Dashboard|Dashboard"
              >
                <span class="aq-acc-action-icon">
                  ${icon('grid')}
                </span>
                Main Dashboard
              </button>

            </div>
          </header>

          <section class="aq-acc-kpis">

            <article class="aq-acc-kpi">
              <span class="aq-acc-kpi-icon is-green">
                ${icon('trend')}
              </span>
              <div>
                <span>Net income</span>
                <strong>${escapeHtml(data.netIncome)}</strong>
                <small>
                  Live posted and shadow-posted ledger balance
                </small>
              </div>
            </article>

            <article class="aq-acc-kpi">
              <span class="aq-acc-kpi-icon is-blue">
                ${icon('wallet')}
              </span>
              <div>
                <span>Cash &amp; MoMo balance</span>
                <strong>${escapeHtml(data.cash)}</strong>
                <small>
                  Live posted and shadow-posted ledger balance
                </small>
              </div>
            </article>

            <article class="aq-acc-kpi">
              <span class="aq-acc-kpi-icon is-orange">
                ${icon('person')}
              </span>
              <div>
                <span>Receivables</span>
                <strong>${escapeHtml(data.receivables)}</strong>
                <small>
                  Live posted and shadow-posted ledger balance
                </small>
              </div>
            </article>

            <article class="aq-acc-kpi">
              <span class="aq-acc-kpi-icon is-red">
                ${icon('card')}
              </span>
              <div>
                <span>Payables</span>
                <strong>${escapeHtml(data.payables)}</strong>
                <small>
                  Live posted and shadow-posted ledger balance
                </small>
              </div>
            </article>

            <article class="aq-acc-kpi aq-acc-kpi--equation">
              <span class="aq-acc-kpi-icon is-purple">
                ${icon('scale')}
              </span>
              <div>
                <span>Accounting equation</span>
                <strong class="aq-acc-equation">
                  ${escapeHtml(data.equation)}
                </strong>
                <small>
                  Live ledger equation status
                </small>
              </div>
            </article>

          </section>

          <section class="aq-acc-primary-grid">

            <article class="aq-acc-card aq-acc-pl">
              <div class="aq-acc-card-head">
                <div>
                  <h2>PROFIT AND LOSS</h2>
                  <span>Income against expenses</span>
                </div>
              </div>

              <div class="aq-acc-pl-body">

                <div
                  class="aq-acc-donut"
                  style="--aq-acc-income-deg:${Number(data.chartDegrees).toFixed(2)}deg"
                  aria-label="Income versus expenses"
                >
                  <span></span>
                </div>

                <div class="aq-acc-pl-values">
                  <div>
                    <i class="is-green"></i>
                    <span>
                      Income
                      <strong>${escapeHtml(data.income)}</strong>
                    </span>
                  </div>

                  <div>
                    <i class="is-red"></i>
                    <span>
                      Expenses
                      <strong>${escapeHtml(data.expenses)}</strong>
                    </span>
                  </div>

                  <div class="aq-acc-pl-net">
                    <span>Net income</span>
                    <strong>${escapeHtml(data.netIncome)}</strong>
                  </div>
                </div>

              </div>

              <div class="aq-acc-pl-footer">
                <span>
                  ↗ &nbsp; Net margin
                </span>
                <strong>
                  ${escapeHtml(data.netMargin)}
                </strong>
              </div>
            </article>

            <article class="aq-acc-card">
              <div class="aq-acc-card-head">
                <div>
                  <h2>ACCOUNT BALANCE SUMMARY</h2>
                  <span>Key accounts</span>
                </div>

                <button
                  type="button"
                  data-native-action="Chart of Accounts"
                >
                  View all
                </button>
              </div>

              <div class="aq-acc-list">
                ${
                  rowsOrEmpty(
                    data.balances,
                    'No live account balance rows are available.'
                  )
                }
              </div>

              <button
                type="button"
                class="aq-acc-card-link"
                data-native-action="Chart of Accounts"
              >
                View all accounts →
              </button>
            </article>

            <article class="aq-acc-card">
              <div class="aq-acc-card-head">
                <div>
                  <h2>EXPENSES BY CATEGORY</h2>
                  <span>Ledger expense accounts</span>
                </div>

                <button
                  type="button"
                  data-native-action="Expenses"
                >
                  View all
                </button>
              </div>

              <div class="aq-acc-list aq-acc-expense-list">
                ${
                  rowsOrEmpty(
                    data.expenseRows,
                    'No live expense category rows are available.'
                  )
                }
              </div>
            </article>

            <article class="aq-acc-card aq-acc-reconciliation">
              <div class="aq-acc-card-head">
                <div>
                  <h2>CASH &amp; MOMO RECONCILIATION</h2>
                  <span>System totals</span>
                </div>
              </div>

              <div class="aq-acc-reconciliation-body">
                <span class="aq-acc-reconciliation-icon">
                  ${icon('book')}
                </span>

                <strong>
                  ${escapeHtml(reconciliation)}
                </strong>

                <span>
                  Actual amount and variance posting remain subject
                  to the Accounting control workflow.
                </span>
              </div>

              <button
                type="button"
                class="aq-acc-card-link"
                data-native-action="Reconciliation dashboard|Reconciliation"
              >
                Reconciliation dashboard →
              </button>
            </article>

          </section>

          <section class="aq-acc-secondary-grid">

            <article class="aq-acc-card">
              <div class="aq-acc-card-head">
                <div>
                  <h2>KEY TASKS</h2>
                  <span>Control attention</span>
                </div>
              </div>

              <div class="aq-acc-task-list">
                ${
                  rowsOrEmpty(
                    data.tasks,
                    'No current Accounting control tasks are available.'
                  )
                }
              </div>

              <button
                type="button"
                class="aq-acc-card-link"
                data-native-action="Control Readiness"
              >
                Go to Control Readiness →
              </button>
            </article>

            <article class="aq-acc-card aq-acc-journals">
              <div class="aq-acc-card-head">
                <div>
                  <h2>RECENT JOURNAL ENTRIES</h2>
                  <span>Latest recognised activity</span>
                </div>

                <button
                  type="button"
                  data-native-action="Journal Register"
                >
                  View all
                </button>
              </div>

              ${journalsHtml(data.journals)}
            </article>

            <div class="aq-acc-side-stack">

              <article class="aq-acc-card aq-acc-mini-card">
                <div class="aq-acc-card-head">
                  <div>
                    <h2>ACCOUNTING PERIOD</h2>
                    <span>Current control window</span>
                  </div>
                </div>

                <div class="aq-acc-mini-body">
                  <span class="aq-acc-mini-icon">
                    ▣
                  </span>

                  <strong>
                    ${escapeHtml(period)}
                  </strong>
                </div>

                <button
                  type="button"
                  class="aq-acc-card-link"
                  data-native-action="Accounting Periods"
                >
                  View periods →
                </button>
              </article>

              <article class="aq-acc-card aq-acc-mini-card">
                <div class="aq-acc-card-head">
                  <div>
                    <h2>ACCOUNTING INSIGHT</h2>
                    <span>Current note</span>
                  </div>
                </div>

                <div class="aq-acc-mini-body">
                  <span class="aq-acc-mini-icon is-orange">
                    ◉
                  </span>

                  <strong>
                    ${escapeHtml(insight)}
                  </strong>
                </div>

                <button
                  type="button"
                  class="aq-acc-card-link"
                  data-native-action="Control Readiness"
                >
                  View details →
                </button>
              </article>

            </div>

          </section>

          <section class="aq-acc-card aq-acc-quick">
            <div class="aq-acc-card-head">
              <div>
                <h2>QUICK ACTIONS</h2>
                <span>Review-ready workspaces</span>
              </div>
            </div>

            <div class="aq-acc-quick-grid">
              ${
                quick.map(
                  ([label, action]) => `
                    <button
                      type="button"
                      data-native-action="${escapeHtml(action)}"
                    >
                      <span class="aq-acc-quick-icon">
                        ${icon('book')}
                      </span>

                      <strong>
                        ${escapeHtml(label)}
                      </strong>
                    </button>
                  `
                ).join('')
              }
            </div>
          </section>

          <div
            class="aq-acc-toast"
            role="status"
            aria-live="polite"
          ></div>

        </main>
      </div>
    `;
  }

  function ensureRoot(workspace) {
    let candidate =
      document.querySelector(
        ROOT_SELECTOR
      );

    if (
      candidate
      &&
      candidate.parentElement
      !== workspace.parentElement
    ) {
      candidate.remove();
      candidate = null;
    }

    if (!candidate) {
      candidate =
        document.createElement(
          'section'
        );

      candidate.setAttribute(
        'data-aquila-accounting-reference-ui',
        '1'
      );

      candidate.setAttribute(
        'data-aquila-owner',
        'accounting-canonical-ui'
      );

      candidate.className =
        'aq-acc-reference-root';

      workspace.before(
        candidate
      );

      candidate.addEventListener(
        'click',
        (event) => {
          const button =
            event.target.closest(
              '[data-native-action],[data-scroll-top]'
            );

          if (
            !button
            ||
            !candidate.contains(button)
          ) {
            return;
          }

          if (
            button.hasAttribute(
              'data-scroll-top'
            )
          ) {
            candidate.scrollIntoView({
              block: 'start',
              behavior: 'smooth',
            });

            return;
          }

          const raw =
            button.getAttribute(
              'data-native-action'
            )
            || '';

          const labels =
            raw
              .split('|')
              .map(clean)
              .filter(Boolean);

          if (labels.length) {
            triggerNative(labels);
          }
        }
      );
    }

    return candidate;
  }

  function showToast(message) {
    if (!root) return;

    const toast =
      root.querySelector(
        '.aq-acc-toast'
      );

    if (!toast) return;

    toast.textContent =
      clean(message);

    toast.classList.add(
      'is-visible'
    );

    window.setTimeout(
      () => {
        toast.classList.remove(
          'is-visible'
        );
      },
      3200
    );
  }

  function externalCandidate(element) {
    let current =
      element;

    let outermost =
      null;

    for (
      let depth = 0;
      depth < 7 && current;
      depth += 1
    ) {
      if (
        current === document.body
        ||
        current === document.documentElement
      ) {
        break;
      }

      /*
       * Never climb into the canonical Accounting root.
       * Canonical Accounting controls belong to R4.2.2.
       */
      if (
        root
        &&
        current === root
      ) {
        break;
      }

      const text =
        clean(
          current.textContent
        );

      const rect =
        current.getBoundingClientRect();

      if (
        text.length >= 5
        &&
        text.length <= 500
        &&
        rect.width > 220
        &&
        rect.height > 32
        &&
        rect.height < 280
      ) {
        /*
         * Keep walking upward.
         * The final eligible shell is the legacy presentation
         * container rather than only its internal action button.
         */
        outermost =
          current;
      }

      current =
        current.parentElement;
    }

    return outermost;
  }

  function markExternalFragments() {
    document
      .querySelectorAll(
        `[${EXTERNAL_FRAGMENT_ATTR}="1"]`
      )
      .forEach(
        (element) =>
          element.removeAttribute(
            EXTERNAL_FRAGMENT_ATTR
          )
      );

    const controls =
      nativeDocuments()
        .flatMap(
          (doc) =>
            Array.from(
              doc.querySelectorAll(
                'button,a,[role="button"],[role="tab"]'
              )
            )
        );

    /*
     * These are legacy/support presentation controls.
     * The global Menu-Deck is not modified.
     */
    const labels = [
      'Open Close Books',
      'Pharmacy Advanced COA',
      'Supplier Payables',
    ];

    for (const label of labels) {
      const candidates =
        controls.filter(
          (element) =>
            clean(
              element.textContent
            ) === label
        );

      for (const candidate of candidates) {
        /*
         * Native Accounting workspaces are hidden in full as
         * support/data engines.
         */
        if (
          candidate.closest(
            NATIVE_SELECTOR
          )
        ) {
          continue;
        }

        /*
         * A legacy support control injected into the new
         * Accounting canonical root is hidden individually.
         */
        if (
          root
          &&
          root.contains(
            candidate
          )
        ) {
          /*
           * Canonical R4.2.2 controls are owned by this UI.
           * Never classify them as legacy fragments.
           */
          continue;
        }

        const fragment =
          externalCandidate(
            candidate
          );

        if (fragment) {
          fragment.setAttribute(
            EXTERNAL_FRAGMENT_ATTR,
            '1'
          );
        }
      }
    }
  }

  function clearExternalFragments() {
    document
      .querySelectorAll(
        `[${EXTERNAL_FRAGMENT_ATTR}="1"]`
      )
      .forEach(
        (element) =>
          element.removeAttribute(
            EXTERNAL_FRAGMENT_ATTR
          )
      );
  }

  function observeNative(workspace) {
    if (
      nativeObserver
      &&
      nativeWorkspace === workspace
    ) {
      return;
    }

    if (nativeObserver) {
      nativeObserver.disconnect();
    }

    nativeObserver =
      new MutationObserver(
        () =>
          schedule(
            'native-mutation'
          )
      );

    nativeObserver.observe(
      workspace,
      {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          'class',
          'aria-selected',
          'aria-pressed',
        ],
      }
    );
  }

  function teardown() {
    generation += 1;

    if (nativeObserver) {
      nativeObserver.disconnect();
      nativeObserver = null;
    }

    document
      .querySelectorAll(
        `[${NATIVE_ENGINE_ATTR}="1"]`
      )
      .forEach(
        (workspace) => {
          workspace.removeAttribute(
            NATIVE_ENGINE_ATTR
          );

          workspace.removeAttribute(
            'aria-hidden'
          );
        }
      );

    clearExternalFragments();

    const existing =
      document.querySelector(
        ROOT_SELECTOR
      );

    if (existing) {
      existing.remove();
    }

    root = null;
    nativeWorkspace = null;
    lastSnapshotKey = '';
  }

  function render(reason) {

    /*
     * AQUILA_ACCOUNTING_R2_RENDER_GATE
     *
     * Leaving Accounting always clears submodule presentation mode.
     */
    if (
      !routeIsAccounting()
    ) {
      leaveAccountingSubmoduleMode();
    }

    scheduled = false;

    if (
      !routeIsAccounting()
    ) {
      teardown();
      return;
    }

    const workspace =
      findNativeWorkspace();

    const mountAnchor =
      findMountAnchor();

    if (
      !workspace
      ||
      !mountAnchor
    ) {
      /*
       * AQUILA_ACCOUNTING_NATIVE_UNMOUNT_TEARDOWN_R8_4
       *
       * Main Finance has left Accounting.
       * Never leave the canonical presentation behind.
       */
      teardown();
      return;
    }

    nativeWorkspace =
      workspace;

    root =
      ensureRoot(
        mountAnchor
      );

    /*
     * Only R4.2.1 remains visible.
     * Native Accounting stays available as hidden live engine.
     */
    markNativeEngines();

    observeNative(
      workspace
    );

    markExternalFragments();

    enforceSinglePresentation();
    markExternalFragments();

    const loadState =
      nativeDataState(
        workspace
      );

    /*
     * Overview live-data readiness must never block an already
     * selected Accounting submodule.
     */
    const activeSubmodule =
      document.documentElement
        .getAttribute(
          'data-aquila-accounting-submodule-active'
        );

    if (activeSubmodule) {
      workspace.setAttribute(
        'data-aquila-accounting-submodule-active',
        '1'
      );

      workspace.setAttribute(
        'data-aquila-accounting-submodule-key',
        activeSubmodule
      );

      workspace.removeAttribute(
        'aria-hidden'
      );

      if (root) {
        root.hidden = true;

        root.setAttribute(
          'data-aquila-accounting-overview-suspended',
          '1'
        );
      }

      markDuplicateQuickActionOwners();

      return;
    }

    workspace.removeAttribute(
      'data-aquila-accounting-submodule-active'
    );

    workspace.removeAttribute(
      'data-aquila-accounting-submodule-key'
    );

    if (root) {
      root.hidden = false;

      root.removeAttribute(
        'data-aquila-accounting-overview-suspended'
      );
    }


    root.dataset.aquilaDataState =
      loadState.state;

    root.dataset.aquilaDataMessage =
      clean(
        loadState.message
      );

    document.documentElement.setAttribute(
      'data-aquila-accounting-data-state',
      loadState.state
    );

    /*
     * No assumed Accounting values.
     * Wait for the authenticated system read model.
     */
    if (
      loadState.state
      !== 'ready'
    ) {
      root.dataset.rendered =
        '0';

      lastSnapshotKey =
        '';

      const stateKey =
        loadState.state
        + '|'
        + clean(
          loadState.message
        );

      if (
        root.dataset.aquilaLiveStateKey
        !== stateKey
      ) {
        root.dataset.aquilaLiveStateKey =
          stateKey;

        root.innerHTML =
          '<div '
          + 'data-aquila-accounting-live-state="'
          + escapeHtml(
              loadState.state
            )
          + '" '
          + 'role="status">'
          + escapeHtml(
              loadState.message
            )
          + '</div>';
      }

      enforceSinglePresentation();
      markExternalFragments();
      syncActionAvailability();

      return;
    }

    delete root.dataset.aquilaLiveStateKey;

    const data =
      snapshot();

    const snapshotKey =
      JSON.stringify(data);

    if (
      snapshotKey === lastSnapshotKey
      &&
      root.dataset.rendered === '1'
    ) {
      enforceSinglePresentation();
      markExternalFragments();
      syncActionAvailability();
      return;
    }

    lastSnapshotKey =
      snapshotKey;

    root.innerHTML =
      canonicalMarkup(data);

    enforceSinglePresentation();
    markExternalFragments();
    syncActionAvailability();

    root.dataset.rendered =
      '1';

    root.dataset.renderReason =
      clean(reason);

    root.dataset.generation =
      String(++generation);

    document.documentElement.setAttribute(
      'data-aquila-accounting-reference-r4',
      'ready'
    );
  }

  function schedule(
    reason = 'schedule'
  ) {
    if (scheduled) return;

    scheduled = true;

    window.requestAnimationFrame(
      () =>
        render(reason)
    );
  }

    window.addEventListener(
      'aquila:accounting-route-refresh',
      () =>
        schedule(
          'loader-route-refresh'
        )
    );

  window.addEventListener(
    'hashchange',
    () =>
      schedule(
        'hashchange'
      ),
    {
      passive: true,
    }
  );

  window.addEventListener(
    'popstate',
    () =>
      schedule(
        'popstate'
      ),
    {
      passive: true,
    }
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        !document.hidden
      ) {
        schedule(
          'visibility'
        );
      }
    }
  );

  window.setTimeout(
    () =>
      schedule('initial'),
    0
  );

  window.setTimeout(
    () =>
      schedule(
        'initial-300'
      ),
    300
  );

  window.setTimeout(
    () =>
      schedule(
        'initial-1000'
      ),
    1000
  );

console.info(
    '[Ubuzima+] Accounting Control Centre R8.4 canonical UI active.'
  );
})();

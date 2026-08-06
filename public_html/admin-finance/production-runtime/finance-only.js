(function () {
  'use strict';

  var generalAdminUrl = '/admin/';

  function readHash() {
    return new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    );
  }

  function ensureFinanceLocation() {
    var params = readHash();
    var section = params.get('section');

    if (section && section !== 'finance') {
      window.location.replace(
        generalAdminUrl
        + '#'
        + params.toString()
      );

      return false;
    }

    params.set('section', 'finance');

    if (!params.get('finance')) {
      params.set('finance', 'overview');
    }

    window.history.replaceState(
      null,
      '',
      '#'
      + params.toString()
    );

    return true;
  }

  function addBackButton() {
    if (
      document.getElementById(
        'ubuzimaFinanceBackToWorkspace'
      )
    ) {
      return;
    }

    var button = document.createElement('button');

    button.id = 'ubuzimaFinanceBackToWorkspace';
    button.type = 'button';
    button.className =
      'ubuzima-finance-back-to-workspace';

    button.textContent = 'Back to workspace';

    button.addEventListener(
      'click',
      function () {
        window.location.assign(
          generalAdminUrl
          + '#section=overview'
        );
      }
    );

    document.body.appendChild(button);
  }

  function applyFinanceOnlyMode() {
    document.documentElement.classList.add(
      'ubuzima-finance-only-runtime'
    );

    addBackButton();
  }

  function boot() {
    if (!ensureFinanceLocation()) {
      return;
    }

    applyFinanceOnlyMode();

    var observer = new MutationObserver(
      applyFinanceOnlyMode
    );

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );
  }

  window.addEventListener(
    'hashchange',
    function () {
      if (ensureFinanceLocation()) {
        applyFinanceOnlyMode();
      }
    }
  );

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once: true }
    );
  } else {
    boot();
  }
})();
/* AQUILA_FINANCE_RUNTIME_ACCOUNTING_ACTIVATOR_V1 */
(function () {
  'use strict';

  var search = new URLSearchParams(
    window.location.search,
  );

  var requestedWorkspace =
    search.get('workspace');

  try {
    requestedWorkspace =
      requestedWorkspace
      || window.sessionStorage.getItem(
        'ubuzima_finance_requested_workspace',
      );
  } catch (_) {
    /* Session storage is optional. */
  }

  requestedWorkspace = String(
    requestedWorkspace || '',
  ).trim().toLowerCase();

  try {
    window.localStorage.setItem(
      'ubuzima_admin_active_section',
      'finance',
    );
  } catch (_) {
    /* Local storage is optional. */
  }

  function normalise(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    var style = window.getComputedStyle(element);

    return (
      style.display !== 'none'
      && style.visibility !== 'hidden'
      && element.getClientRects().length > 0
    );
  }

  function findControl(label) {
    var expected = normalise(label);

    var controls = Array.prototype.slice.call(
      document.querySelectorAll(
        'a,button,[role="button"]',
      ),
    ).filter(isVisible);

    var exact = controls.find(
      function (control) {
        return normalise(
          control.textContent
          || control.getAttribute('aria-label')
          || control.getAttribute('title'),
        ) === expected;
      },
    );

    if (exact) {
      return exact;
    }

    var candidates = controls.filter(
      function (control) {
        var text = normalise(
          control.textContent
          || control.getAttribute('aria-label')
          || control.getAttribute('title'),
        );

        return text.indexOf(
          expected + ' ',
        ) === 0;
      },
    );

    candidates.sort(
      function (left, right) {
        return normalise(
          left.textContent,
        ).length - normalise(
          right.textContent,
        ).length;
      },
    );

    return candidates[0] || null;
  }

  function accountingIsOpen() {
    if (
      document.querySelector(
        '.acct-hero,'
        + '.acct-tabs,'
        + '.accounting-workspace,'
        + '[aria-label="Accounting workspaces"]',
      )
    ) {
      return true;
    }

    var headings = Array.prototype.slice.call(
      document.querySelectorAll(
        'h1,h2,[role="heading"]',
      ),
    );

    return headings.some(
      function (heading) {
        var text = normalise(
          heading.textContent,
        );

        return (
          text === 'accounting overview'
          || text === 'accounting control centre'
        );
      },
    );
  }

  function financeIsOpen() {
    if (accountingIsOpen()) {
      return true;
    }

    if (findControl('accounting')) {
      return true;
    }

    var headings = Array.prototype.slice.call(
      document.querySelectorAll(
        'h1,h2,[role="heading"]',
      ),
    );

    return headings.some(
      function (heading) {
        var text = normalise(
          heading.textContent,
        );

        return (
          text === 'finance overview'
          || text === 'finance modules'
          || text.indexOf('finance and control') === 0
        );
      },
    );
  }

  function enforceFinanceHash() {
    var params = new URLSearchParams(
      window.location.hash.replace(/^#/, ''),
    );

    params.set('section', 'finance');

    if (
      requestedWorkspace === 'accounting'
    ) {
      params.set(
        'workspace',
        'accounting',
      );
    }

    var expectedHash =
      '#' + params.toString();

    if (
      window.location.hash !== expectedHash
    ) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname
          + window.location.search
          + expectedHash,
      );

      try {
        window.dispatchEvent(
          new HashChangeEvent('hashchange'),
        );
      } catch (_) {
        window.dispatchEvent(
          new Event('hashchange'),
        );
      }
    }
  }

  function clearCompletedRequest() {
    try {
      window.sessionStorage.removeItem(
        'ubuzima_finance_requested_workspace',
      );
    } catch (_) {
      /* Session storage is optional. */
    }

    var url = new URL(
      window.location.href,
    );

    url.searchParams.delete(
      'workspace',
    );

    window.history.replaceState(
      null,
      '',
      url.pathname
        + (
          url.searchParams.toString()
            ? '?' + url.searchParams.toString()
            : ''
        )
        + url.hash,
    );
  }

  var lastFinanceClick = 0;
  var lastAccountingClick = 0;
  var finished = false;

  function clickWithCooldown(
    control,
    type,
  ) {
    var now = Date.now();

    if (type === 'finance') {
      if (
        now - lastFinanceClick < 1500
      ) {
        return false;
      }

      lastFinanceClick = now;
    } else {
      if (
        now - lastAccountingClick < 1500
      ) {
        return false;
      }

      lastAccountingClick = now;
    }

    control.click();

    return true;
  }

  function activateRequestedWorkspace() {
    if (finished) {
      return true;
    }

    enforceFinanceHash();

    if (
      requestedWorkspace === 'accounting'
      && accountingIsOpen()
    ) {
      finished = true;
      clearCompletedRequest();

      document.documentElement.setAttribute(
        'data-accounting-runtime-active',
        'true',
      );

      return true;
    }

    if (!financeIsOpen()) {
      var financeControl =
        findControl('finance');

      if (financeControl) {
        clickWithCooldown(
          financeControl,
          'finance',
        );
      }

      return false;
    }

    if (
      requestedWorkspace === 'accounting'
    ) {
      var accountingControl =
        findControl('accounting');

      if (accountingControl) {
        clickWithCooldown(
          accountingControl,
          'accounting',
        );
      }

      return false;
    }

    finished = true;

    return true;
  }

  document.documentElement.setAttribute(
    'data-finance-runtime',
    'true',
  );

  var observer = new MutationObserver(
    activateRequestedWorkspace,
  );

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'hidden',
        'aria-hidden',
      ],
    },
  );

  var interval = window.setInterval(
    function () {
      if (activateRequestedWorkspace()) {
        window.clearInterval(interval);
        observer.disconnect();
      }
    },
    250,
  );

  window.setTimeout(
    function () {
      window.clearInterval(interval);
      observer.disconnect();
    },
    20000,
  );

  activateRequestedWorkspace();

  window.__ubuzimaFinanceAccountingActivator = {
    version: '20260730T110820Z',
    requestedWorkspace: requestedWorkspace,
  };
}());

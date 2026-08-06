(function () {
  'use strict';

  var financeUrl = '/admin-finance/';

  function readHash() {
    return new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    );
  }

  function redirectToFinance() {
    var params = readHash();

    if (params.get('section') !== 'finance') {
      return false;
    }

    if (!params.get('finance')) {
      params.set('finance', 'overview');
    }

    window.location.replace(
      financeUrl + '#' + params.toString()
    );

    return true;
  }

  window.addEventListener(
    'hashchange',
    redirectToFinance
  );

  document.addEventListener(
    'DOMContentLoaded',
    redirectToFinance
  );

  document.addEventListener(
    'click',
    function () {
      window.setTimeout(
        redirectToFinance,
        0
      );
    },
    true
  );

  redirectToFinance();
})();
/* AQUILA_ACCOUNTING_NAVIGATION_BRIDGE_V1 */
(function () {
  'use strict';

  var accountingUrl =
    '/admin-finance/?workspace=accounting';

  function normalise(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function rememberAccountingRequest() {
    try {
      window.sessionStorage.setItem(
        'ubuzima_finance_requested_workspace',
        'accounting',
      );
    } catch (_) {
      /* Session storage is optional. */
    }
  }

  function redirectToAccounting() {
    rememberAccountingRequest();

    window.location.assign(accountingUrl);
  }

  function isAccountingControl(control) {
    var label = normalise(
      control.textContent
      || control.getAttribute('aria-label')
      || control.getAttribute('title'),
    );

    return (
      label === 'accounting'
      || label === 'open accounting'
      || label.indexOf('accounting ') === 0
    );
  }

  document.addEventListener(
    'click',
    function (event) {
      var node = event.target;

      if (!(node instanceof Element)) {
        return;
      }

      var control = node.closest(
        'a,button,[role="button"]',
      );

      if (
        !control
        || !isAccountingControl(control)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      redirectToAccounting();
    },
    true,
  );

  window.__ubuzimaAccountingNavigationBridge = {
    version: '20260730T110820Z',
    target: accountingUrl,
  };
}());

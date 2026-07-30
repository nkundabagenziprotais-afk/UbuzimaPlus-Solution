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

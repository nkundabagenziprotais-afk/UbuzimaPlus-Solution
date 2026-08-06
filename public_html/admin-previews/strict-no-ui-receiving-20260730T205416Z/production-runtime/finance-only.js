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

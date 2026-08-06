(function () {
  'use strict';

  var VERSION =
    '2026.08.pos-checkout-navigation-guard-v10';

  if (
    window.__UBUZIMA_POS_NAVIGATION_GUARD_V10__
  ) {
    return;
  }

  var state = {
    installedAt:
      new Date().toISOString(),

    blockedWindowOpens: 0,
    blockedBlankWindows: 0,
    blockedDuplicateAdminWindows: 0,
    blockedAnchorNavigations: 0,
    blockedFormNavigations: 0,
    blockedProgrammaticAnchorClicks: 0,
    blockedProgrammaticFormSubmits: 0,
    allowedExternalWindows: 0
  };

  var nativeOpen =
    typeof window.open === 'function'
      ? window.open.bind(window)
      : null;

  var nativeAnchorClick =
    window.HTMLAnchorElement &&
    window.HTMLAnchorElement.prototype &&
    window.HTMLAnchorElement.prototype.click
      ? window.HTMLAnchorElement
          .prototype
          .click
      : null;

  var nativeFormSubmit =
    window.HTMLFormElement &&
    window.HTMLFormElement.prototype &&
    window.HTMLFormElement.prototype.submit
      ? window.HTMLFormElement
          .prototype
          .submit
      : null;

  var nativeRequestSubmit =
    window.HTMLFormElement &&
    window.HTMLFormElement.prototype &&
    window.HTMLFormElement.prototype
      .requestSubmit
      ? window.HTMLFormElement
          .prototype
          .requestSubmit
      : null;

  function normalizePath(pathname) {
    var value =
      String(pathname || '/')
        .replace(/\/+$/, '');

    return value || '/';
  }

  function resolveUrl(value) {
    try {
      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ''
      ) {
        return null;
      }

      return new URL(
        String(value),
        window.location.href
      );
    } catch (error) {
      return null;
    }
  }

  function blankDestination(value) {
    var text =
      value === null ||
      value === undefined
        ? ''
        : String(value).trim();

    return (
      text === '' ||
      text === 'about:blank' ||
      text === 'about:blank#blocked'
    );
  }

  function targetCreatesAnotherContext(
    target
  ) {
    var name =
      String(
        target || '_blank'
      ).trim().toLowerCase();

    return (
      name === '' ||
      name === '_blank' ||
      (
        name !== '_self' &&
        name !== '_parent' &&
        name !== '_top'
      )
    );
  }

  function duplicateAdminDestination(
    value,
    target
  ) {
    if (
      !targetCreatesAnotherContext(
        target
      )
    ) {
      return false;
    }

    var destination =
      resolveUrl(value);

    var current =
      resolveUrl(
        window.location.href
      );

    if (
      !destination ||
      !current
    ) {
      return false;
    }

    var destinationPath =
      normalizePath(
        destination.pathname
      );

    var currentPath =
      normalizePath(
        current.pathname
      );

    return (
      destination.origin ===
        current.origin &&
      destinationPath ===
        currentPath &&
      currentPath === '/admin'
    );
  }

  function prohibitedDestination(
    value,
    target
  ) {
    return (
      blankDestination(value) ||
      duplicateAdminDestination(
        value,
        target
      )
    );
  }

  function inertWindow() {
    var documentText = '';

    var documentShim = {
      body: {
        textContent: ''
      },

      open: function () {
        documentText = '';
        this.body.textContent = '';
      },

      write: function (value) {
        documentText +=
          String(value || '');

        this.body.textContent =
          documentText
            .replace(
              /<style[\s\S]*?<\/style>/gi,
              ' '
            )
            .replace(
              /<script[\s\S]*?<\/script>/gi,
              ' '
            )
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
      },

      close: function () {},

      querySelector: function () {
        return null;
      }
    };

    var locationShim = {
      href: 'about:blank',

      assign: function () {},
      replace: function () {},

      toString: function () {
        return 'about:blank';
      }
    };

    var shim = {
      closed: false,
      document: documentShim,
      location: locationShim,
      opener: window,

      focus: function () {},
      blur: function () {},
      print: function () {},

      close: function () {
        this.closed = true;
      },

      postMessage: function () {},

      setTimeout:
        window.setTimeout
          ? window.setTimeout.bind(window)
          : function () {},

      requestAnimationFrame:
        window.requestAnimationFrame
          ? window
              .requestAnimationFrame
              .bind(window)
          : function (callback) {
              return window.setTimeout(
                callback,
                16
              );
            },

      __ubuzimaBlockedNavigation:
        true
    };

    if (
      typeof Proxy === 'function'
    ) {
      return new Proxy(
        shim,
        {
          set: function (
            target,
            property,
            value
          ) {
            if (
              property === 'location' ||
              property === 'href'
            ) {
              return true;
            }

            target[property] = value;
            return true;
          }
        }
      );
    }

    return shim;
  }

  window.open = function (
    url,
    target,
    features
  ) {
    if (
      prohibitedDestination(
        url,
        target
      )
    ) {
      state.blockedWindowOpens +=
        1;

      if (blankDestination(url)) {
        state.blockedBlankWindows +=
          1;
      } else {
        state
          .blockedDuplicateAdminWindows +=
          1;
      }

      return inertWindow();
    }

    state.allowedExternalWindows +=
      1;

    if (!nativeOpen) {
      return null;
    }

    return nativeOpen(
      url,
      target,
      features
    );
  };

  function anchorDestination(anchor) {
    if (!anchor) {
      return null;
    }

    return (
      anchor.getAttribute('href') ||
      anchor.href ||
      null
    );
  }

  function anchorTarget(anchor) {
    if (!anchor) {
      return '_self';
    }

    return (
      anchor.getAttribute('target') ||
      anchor.target ||
      '_self'
    );
  }

  function formDestination(form) {
    if (!form) {
      return null;
    }

    return (
      form.getAttribute('action') ||
      form.action ||
      window.location.href
    );
  }

  function formTarget(form) {
    if (!form) {
      return '_self';
    }

    return (
      form.getAttribute('target') ||
      form.target ||
      '_self'
    );
  }

  document.addEventListener(
    'click',
    function (event) {
      var target =
        event.target instanceof Element
          ? event.target
          : null;

      if (
        !target ||
        typeof target.closest !==
          'function'
      ) {
        return;
      }

      var anchor =
        target.closest(
          'a,area'
        );

      if (
        anchor &&
        prohibitedDestination(
          anchorDestination(anchor),
          anchorTarget(anchor)
        )
      ) {
        event.preventDefault();

        state.blockedAnchorNavigations +=
          1;
      }

      var submitControl =
        target.closest(
          'button[formtarget],input[formtarget]'
        );

      if (submitControl) {
        var destination =
          submitControl.getAttribute(
            'formaction'
          ) ||
          (
            submitControl.form
              ? formDestination(
                  submitControl.form
                )
              : window.location.href
          );

        var targetName =
          submitControl.getAttribute(
            'formtarget'
          );

        if (
          prohibitedDestination(
            destination,
            targetName
          )
        ) {
          event.preventDefault();

          state.blockedFormNavigations +=
            1;
        }
      }
    },
    true
  );

  document.addEventListener(
    'submit',
    function (event) {
      var form =
        event.target instanceof
          HTMLFormElement
          ? event.target
          : null;

      if (
        form &&
        prohibitedDestination(
          formDestination(form),
          formTarget(form)
        )
      ) {
        event.preventDefault();

        state.blockedFormNavigations +=
          1;
      }
    },
    true
  );

  if (nativeAnchorClick) {
    window.HTMLAnchorElement
      .prototype
      .click = function () {
        if (
          prohibitedDestination(
            anchorDestination(this),
            anchorTarget(this)
          )
        ) {
          state
            .blockedProgrammaticAnchorClicks +=
            1;

          var clickEvent =
            new MouseEvent(
              'click',
              {
                bubbles: true,
                cancelable: true,
                view: window
              }
            );

          this.dispatchEvent(
            clickEvent
          );

          return;
        }

        return nativeAnchorClick
          .apply(
            this,
            arguments
          );
      };
  }

  if (nativeFormSubmit) {
    window.HTMLFormElement
      .prototype
      .submit = function () {
        if (
          prohibitedDestination(
            formDestination(this),
            formTarget(this)
          )
        ) {
          state
            .blockedProgrammaticFormSubmits +=
            1;

          var submitEvent =
            new Event(
              'submit',
              {
                bubbles: true,
                cancelable: true
              }
            );

          this.dispatchEvent(
            submitEvent
          );

          return;
        }

        return nativeFormSubmit
          .apply(
            this,
            arguments
          );
      };
  }

  if (nativeRequestSubmit) {
    window.HTMLFormElement
      .prototype
      .requestSubmit = function () {
        if (
          prohibitedDestination(
            formDestination(this),
            formTarget(this)
          )
        ) {
          state
            .blockedProgrammaticFormSubmits +=
            1;
        }

        return nativeRequestSubmit
          .apply(
            this,
            arguments
          );
      };
  }

  window
    .__UBUZIMA_POS_NAVIGATION_GUARD_V10__ = {
      version: VERSION,

      diagnostics: function () {
        return {
          version: VERSION,
          installed_at:
            state.installedAt,

          load_policy:
            'synchronous-before-main-application',

          blocked_window_opens:
            state.blockedWindowOpens,

          blocked_blank_windows:
            state.blockedBlankWindows,

          blocked_duplicate_admin_windows:
            state.blockedDuplicateAdminWindows,

          blocked_anchor_navigations:
            state.blockedAnchorNavigations,

          blocked_form_navigations:
            state.blockedFormNavigations,

          blocked_programmatic_anchor_clicks:
            state
              .blockedProgrammaticAnchorClicks,

          blocked_programmatic_form_submits:
            state
              .blockedProgrammaticFormSubmits,

          allowed_external_windows:
            state.allowedExternalWindows,

          checkout_destination:
            'existing-pos-dashboard'
        };
      },

      isBlocked:
        prohibitedDestination
    };

  console.info(
    '[UbuzimaPlus] Early POS navigation guard loaded.',
    VERSION
  );
}());

(function () {
  'use strict';

  if (window.__UBUZIMA_POS_TERMINAL_V4__) {
    return;
  }

  var VERSION =
    '2026.08.pos-terminal-context-v4';

  var STORAGE_KEY =
    'ubuzima.pos.terminal.identity.v1';

  var OPEN_SUFFIX =
    '/pharmaco/pos/session/open';

  var CURRENT_SUFFIX =
    '/pharmaco/pos/session/current';

  var CHECKOUT_SUFFIX =
    '/pharmaco/sales/checkout';

  var SALES_SUFFIX =
    '/pharmaco/sales';

  if (typeof window.fetch !== 'function') {
    return;
  }

  var originalFetch =
    window.fetch.bind(window);

  var state = {
    branchId: null,
    sessionId: null,
    openRequestsModified: 0,
    currentRequestsModified: 0,
    checkoutRequestsModified: 0
  };

  function validIdentifier(value) {
    return (
      typeof value === 'string' &&
      value.length >= 8 &&
      value.length <= 100 &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]+$/.test(
        value
      )
    );
  }

  function randomEntropy() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        'function'
    ) {
      return window.crypto.randomUUID();
    }

    if (
      window.crypto &&
      typeof window.crypto.getRandomValues ===
        'function'
    ) {
      var values =
        new Uint8Array(16);

      window.crypto.getRandomValues(
        values
      );

      return Array.prototype.map.call(
        values,
        function (value) {
          return value
            .toString(16)
            .padStart(2, '0');
        }
      ).join('');
    }

    return [
      Date.now().toString(36),
      Math.random().toString(36).slice(2),
      Math.random().toString(36).slice(2)
    ].join('-');
  }

  function getTerminalIdentity() {
    try {
      var stored =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (stored) {
        var parsed =
          JSON.parse(stored);

        if (
          validIdentifier(
            parsed &&
            parsed.identifier
          )
        ) {
          return {
            identifier:
              parsed.identifier
                .trim()
                .toLowerCase(),

            label:
              typeof parsed.label ===
                'string' &&
              parsed.label.trim() !== ''
                ? parsed.label
                    .trim()
                    .slice(0, 100)
                : 'Web POS terminal'
          };
        }
      }
    } catch (error) {
      console.warn(
        '[UbuzimaPlus] Stored POS terminal identity was invalid.',
        error
      );
    }

    var identifier =
      (
        'web-' + randomEntropy()
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9._:-]/g,
          '-'
        )
        .slice(0, 100);

    if (identifier.length < 8) {
      identifier =
        (
          identifier +
          '-terminal'
        ).slice(0, 100);
    }

    var platform =
      navigator.platform ||
      'Web browser';

    var identity = {
      identifier: identifier,
      label:
        (
          'Web POS · ' +
          platform
        ).slice(0, 100)
    };

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(identity)
      );
    } catch (error) {
      console.warn(
        '[UbuzimaPlus] POS terminal identity could not be persisted.',
        error
      );
    }

    return identity;
  }

  var terminal =
    getTerminalIdentity();

  function roughUrl(input) {
    if (typeof input === 'string') {
      return input;
    }

    if (
      input &&
      typeof input.url === 'string'
    ) {
      return input.url;
    }

    return '';
  }

  function roughMethod(input, init) {
    if (
      init &&
      typeof init.method === 'string'
    ) {
      return init.method.toUpperCase();
    }

    if (
      input &&
      typeof input.method === 'string'
    ) {
      return input.method.toUpperCase();
    }

    return 'GET';
  }

  function isPotentialPosRequest(
    rough,
    method
  ) {
    if (
      method === 'POST' &&
      (
        rough.indexOf(OPEN_SUFFIX) !== -1 ||
        rough.indexOf(CHECKOUT_SUFFIX) !== -1 ||
        rough.indexOf(SALES_SUFFIX) !== -1
      )
    ) {
      return true;
    }

    return (
      method === 'GET' &&
      rough.indexOf(CURRENT_SUFFIX) !== -1
    );
  }

  function requestFrom(input, init) {
    if (input instanceof Request) {
      return new Request(
        input,
        init
      );
    }

    return new Request(
      new URL(
        String(input),
        window.location.href
      ).toString(),
      init
    );
  }

  function pathEndsWith(
    pathname,
    suffix
  ) {
    return (
      pathname.replace(/\/+$/, '')
        .endsWith(suffix)
    );
  }

  async function jsonBody(request) {
    try {
      var text =
        await request.clone().text();

      if (!text || text.trim() === '') {
        return null;
      }

      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function requestOptions(
    request,
    headers
  ) {
    return {
      method: request.method,
      headers: headers,
      credentials:
        request.credentials,
      cache: request.cache,
      redirect: request.redirect,
      referrer:
        request.referrer,
      referrerPolicy:
        request.referrerPolicy,
      integrity:
        request.integrity,
      keepalive:
        request.keepalive,
      mode: request.mode,
      signal:
        request.signal
    };
  }

  function requestWithJson(
    request,
    url,
    payload
  ) {
    var headers =
      new Headers(request.headers);

    headers.set(
      'Content-Type',
      'application/json'
    );

    headers.set(
      'Accept',
      'application/json'
    );

    var options =
      requestOptions(
        request,
        headers
      );

    options.body =
      JSON.stringify(payload);

    return new Request(
      url.toString(),
      options
    );
  }

  function captureSession(
    response
  ) {
    if (!response.ok) {
      return;
    }

    var contentType =
      response.headers.get(
        'content-type'
      ) || '';

    if (
      contentType.indexOf(
        'application/json'
      ) === -1
    ) {
      return;
    }

    response.clone().json()
      .then(function (payload) {
        var session =
          payload &&
          payload.session;

        if (
          session &&
          Number(session.id) > 0
        ) {
          state.sessionId =
            Number(session.id);
        }

        if (
          session &&
          Number(session.branch_id) > 0
        ) {
          state.branchId =
            Number(
              session.branch_id
            );
        }
      })
      .catch(function () {
        return null;
      });
  }

  async function handleRelevantRequest(
    input,
    init
  ) {
    var request =
      requestFrom(input, init);

    var method =
      request.method.toUpperCase();

    var url =
      new URL(request.url);

    if (
      method === 'GET' &&
      pathEndsWith(
        url.pathname,
        CURRENT_SUFFIX
      )
    ) {
      var queryBranch =
        Number(
          url.searchParams.get(
            'branch_id'
          )
        );

      if (queryBranch > 0) {
        state.branchId =
          queryBranch;
      }

      if (
        state.branchId &&
        !url.searchParams.has(
          'branch_id'
        )
      ) {
        url.searchParams.set(
          'branch_id',
          String(state.branchId)
        );
      }

      url.searchParams.set(
        'terminal_identifier',
        terminal.identifier
      );

      state.currentRequestsModified +=
        1;

      var currentResponse =
        await originalFetch(
          new Request(
            url.toString(),
            requestOptions(
              request,
              new Headers(
                request.headers
              )
            )
          )
        );

      captureSession(
        currentResponse
      );

      return currentResponse;
    }

    if (
      method === 'POST' &&
      pathEndsWith(
        url.pathname,
        OPEN_SUFFIX
      )
    ) {
      var openPayload =
        await jsonBody(request);

      if (
        !openPayload ||
        typeof openPayload !==
          'object'
      ) {
        return originalFetch(
          input,
          init
        );
      }

      if (
        Number(
          openPayload.branch_id
        ) > 0
      ) {
        state.branchId =
          Number(
            openPayload.branch_id
          );
      }

      openPayload.terminal_identifier =
        terminal.identifier;

      openPayload.terminal_label =
        terminal.label;

      state.openRequestsModified +=
        1;

      var openResponse =
        await originalFetch(
          requestWithJson(
            request,
            url,
            openPayload
          )
        );

      captureSession(
        openResponse
      );

      return openResponse;
    }

    if (
      method === 'POST' &&
      (
        pathEndsWith(
          url.pathname,
          CHECKOUT_SUFFIX
        ) ||
        pathEndsWith(
          url.pathname,
          SALES_SUFFIX
        )
      )
    ) {
      var checkoutPayload =
        await jsonBody(request);

      if (
        !checkoutPayload ||
        typeof checkoutPayload !==
          'object'
      ) {
        return originalFetch(
          input,
          init
        );
      }

      /*
       * The older live sale-create request also uses
       * POST /pharmaco/sales. It is modified only when
       * it carries the canonical checkout idempotency key
       * or already carries POS session fields.
       */
      var canonicalCheckout =
        pathEndsWith(
          url.pathname,
          CHECKOUT_SUFFIX
        ) ||
        Object.prototype
          .hasOwnProperty.call(
            checkoutPayload,
            'idempotency_key'
          ) ||
        Object.prototype
          .hasOwnProperty.call(
            checkoutPayload,
            'pos_session_id'
          );

      if (!canonicalCheckout) {
        return originalFetch(
          input,
          init
        );
      }

      checkoutPayload
        .terminal_identifier =
        terminal.identifier;

      if (
        !checkoutPayload
          .pos_session_id &&
        state.sessionId
      ) {
        checkoutPayload
          .pos_session_id =
          state.sessionId;
      }

      state.checkoutRequestsModified +=
        1;

      return originalFetch(
        requestWithJson(
          request,
          url,
          checkoutPayload
        )
      );
    }

    return originalFetch(
      input,
      init
    );
  }

  window.fetch = function (
    input,
    init
  ) {
    var rough =
      roughUrl(input);

    var method =
      roughMethod(
        input,
        init
      );

    /*
     * Performance boundary:
     * inventory and every unrelated request go directly
     * to the existing live application fetch implementation.
     */
    if (
      !isPotentialPosRequest(
        rough,
        method
      )
    ) {
      return originalFetch(
        input,
        init
      );
    }

    return handleRelevantRequest(
      input,
      init
    );
  };

  window.__UBUZIMA_POS_TERMINAL_V4__ = {
    version: VERSION,
    terminal: terminal,

    diagnostics: function () {
      return {
        version: VERSION,
        terminal_identifier:
          terminal.identifier,
        terminal_label:
          terminal.label,
        branch_id:
          state.branchId,
        pos_session_id:
          state.sessionId,
        open_requests_modified:
          state.openRequestsModified,
        current_requests_modified:
          state.currentRequestsModified,
        checkout_requests_modified:
          state.checkoutRequestsModified,
        inventory_interception:
          false,
        unrelated_request_interception:
          false,
        dom_observer:
          false,
        polling_interval:
          false
      };
    }
  };

  console.info(
    '[UbuzimaPlus] POS terminal context V4 loaded.',
    VERSION
  );
}());

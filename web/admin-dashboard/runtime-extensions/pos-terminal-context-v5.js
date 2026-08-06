(function () {
  'use strict';

  if (window.__UBUZIMA_POS_TERMINAL_V5__) {
    return;
  }

  var VERSION =
    '2026.08.pos-branch-refresh-context-v5';

  var STORAGE_KEY =
    'ubuzima.pos.terminal.identity.v1';

  var BRANCH_STORAGE_KEY =
    'ubuzima.pos.branch.context.v1';

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
    branchId: loadStoredBranchId(),
    sessionId: null,
    openRequestsModified: 0,
    currentRequestsModified: 0,
    checkoutRequestsModified: 0
  };

  function positiveBranchId(value) {
    var parsed = Number(value);

    return (
      Number.isInteger(parsed) &&
      parsed > 0
    )
      ? parsed
      : null;
  }

  function loadStoredBranchId() {
    try {
      var stored =
        window.localStorage.getItem(
          BRANCH_STORAGE_KEY
        );

      if (!stored) {
        return null;
      }

      var parsed =
        JSON.parse(stored);

      var branchId =
        positiveBranchId(
          parsed &&
          parsed.branch_id
        );

      var updatedAt =
        Number(
          parsed &&
          parsed.updated_at
        );

      if (!branchId) {
        return null;
      }

      if (
        updatedAt > 0 &&
        Date.now() - updatedAt >
          72 * 60 * 60 * 1000
      ) {
        window.localStorage.removeItem(
          BRANCH_STORAGE_KEY
        );

        return null;
      }

      return branchId;
    } catch (error) {
      return null;
    }
  }

  function persistBranchId(value) {
    var branchId =
      positiveBranchId(value);

    if (!branchId) {
      return null;
    }

    state.branchId =
      branchId;

    try {
      window.localStorage.setItem(
        BRANCH_STORAGE_KEY,
        JSON.stringify({
          branch_id: branchId,
          updated_at: Date.now()
        })
      );
    } catch (error) {
      console.warn(
        '[UbuzimaPlus] POS branch context could not be persisted.',
        error
      );
    }

    return branchId;
  }

  function branchFromContextObject(
    value
  ) {
    if (
      !value ||
      typeof value !== 'object'
    ) {
      return null;
    }

    var candidates = [
      value.assigned_branch_id,
      value.current_branch_id,
      value.scope &&
        value.scope.branch_id,
      value.branch &&
        value.branch.id,
      value.tenant_assignment &&
        value.tenant_assignment.branch_id,
      value.tenant_assignment &&
        value.tenant_assignment.branch &&
        value.tenant_assignment.branch.id
    ];

    if (
      Array.isArray(
        value.tenant_assignments
      )
    ) {
      value.tenant_assignments.forEach(
        function (assignment) {
          candidates.push(
            assignment &&
              assignment.branch_id
          );

          candidates.push(
            assignment &&
              assignment.branch &&
              assignment.branch.id
          );
        }
      );
    }

    for (
      var index = 0;
      index < candidates.length;
      index += 1
    ) {
      var branchId =
        positiveBranchId(
          candidates[index]
        );

      if (branchId) {
        return branchId;
      }
    }

    var nestedKeys = [
      'auth',
      'user',
      'profile',
      'data',
      'context'
    ];

    for (
      var nestedIndex = 0;
      nestedIndex < nestedKeys.length;
      nestedIndex += 1
    ) {
      var nested =
        value[
          nestedKeys[nestedIndex]
        ];

      var nestedBranch =
        branchFromContextObject(
          nested
        );

      if (nestedBranch) {
        return nestedBranch;
      }
    }

    return null;
  }

  function branchFromBrowserStorage() {
    var stores = [
      window.sessionStorage,
      window.localStorage
    ];

    for (
      var storeIndex = 0;
      storeIndex < stores.length;
      storeIndex += 1
    ) {
      var store =
        stores[storeIndex];

      if (
        !store ||
        typeof store.length !==
          'number'
      ) {
        continue;
      }

      for (
        var keyIndex = 0;
        keyIndex < store.length;
        keyIndex += 1
      ) {
        var key =
          store.key(keyIndex);

        if (
          !key ||
          !/(auth|user|tenant|profile|scope|session)/i.test(
            key
          )
        ) {
          continue;
        }

        try {
          var value =
            JSON.parse(
              store.getItem(key)
            );

          var branchId =
            branchFromContextObject(
              value
            );

          if (branchId) {
            return branchId;
          }
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  function branchFromBranchesPayload(
    payload
  ) {
    if (
      payload &&
      payload.scope
    ) {
      var scoped =
        positiveBranchId(
          payload.scope.branch_id
        );

      if (scoped) {
        return scoped;
      }
    }

    var branches =
      Array.isArray(
        payload &&
        payload.branches
      )
        ? payload.branches
        : (
          payload &&
          payload.data &&
          Array.isArray(
            payload.data.branches
          )
            ? payload.data.branches
            : []
        );

    var active =
      branches.filter(
        function (branch) {
          return (
            branch &&
            positiveBranchId(
              branch.id
            ) &&
            (
              branch.status ===
                undefined ||
              branch.status ===
                null ||
              branch.status ===
                'active'
            )
          );
        }
      );

    var preferred =
      active.find(
        function (branch) {
          return (
            branch.is_default ===
              true ||
            branch.is_primary ===
              true ||
            branch.default ===
              true
          );
        }
      );

    if (preferred) {
      return positiveBranchId(
        preferred.id
      );
    }

    if (active.length === 1) {
      return positiveBranchId(
        active[0].id
      );
    }

    return null;
  }

  async function resolveBranchId(
    request,
    currentUrl
  ) {
    var queryBranch =
      positiveBranchId(
        currentUrl.searchParams.get(
          'branch_id'
        )
      );

    if (queryBranch) {
      return persistBranchId(
        queryBranch
      );
    }

    if (state.branchId) {
      return state.branchId;
    }

    var storedContextBranch =
      branchFromBrowserStorage();

    if (storedContextBranch) {
      return persistBranchId(
        storedContextBranch
      );
    }

    try {
      var branchesUrl =
        new URL(
          currentUrl.toString()
        );

      branchesUrl.pathname =
        branchesUrl.pathname.replace(
          /\/pharmaco\/pos\/session\/current$/,
          '/pharmaco/branches'
        );

      branchesUrl.search = '';

      var headers =
        new Headers(
          request.headers
        );

      headers.set(
        'Accept',
        'application/json'
      );

      var response =
        await originalFetch(
          new Request(
            branchesUrl.toString(),
            {
              method: 'GET',
              headers: headers,
              credentials:
                request.credentials,
              cache: 'no-store'
            }
          )
        );

      if (response.ok) {
        var payload =
          await response.json();

        var branchId =
          branchFromBranchesPayload(
            payload
          );

        if (branchId) {
          return persistBranchId(
            branchId
          );
        }
      }
    } catch (error) {
      console.warn(
        '[UbuzimaPlus] POS branch context could not be resolved automatically.',
        error
      );
    }

    return null;
  }

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
          persistBranchId(
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
      var resolvedBranchId =
        await resolveBranchId(
          request,
          url
        );

      if (resolvedBranchId) {
        url.searchParams.set(
          'branch_id',
          String(
            resolvedBranchId
          )
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
        persistBranchId(
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
      if (
        Number(
          checkoutPayload.branch_id
        ) > 0
      ) {
        persistBranchId(
          checkoutPayload.branch_id
        );
      }

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

  window.__UBUZIMA_POS_TERMINAL_V5__ = {
    version: VERSION,
    terminal: terminal,

    diagnostics: function () {
      return {
        version: VERSION,
        terminal_identifier:
          terminal.identifier,
        terminal_label:
          terminal.label,
        branch_storage_key:
          BRANCH_STORAGE_KEY,
        branch_context_persisted:
          Boolean(state.branchId),
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
    '[UbuzimaPlus] POS branch refresh context V5 loaded.',
    VERSION
  );
}());

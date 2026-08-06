(function () {
  'use strict';

  if (
    window.__UBUZIMA_LIVE_POS_EXTENSION__ &&
    window.__UBUZIMA_LIVE_POS_EXTENSION__.version ===
      '2026.08.performance-v2'
  ) {
    return;
  }

  var VERSION = '2026.08.performance-v2';
  var STORAGE_KEY =
    'ubuzima.pos.terminal.identity.v1';

  var USER_ENDPOINTS = ["/api/v1/access-check/security/users","/api/v1/security/users","/api/v1/tenant/users"];
  var BRANCH_ENDPOINTS = ["/api/v1/pharmaco/branches","/api/v1/security/branches","/api/v1/tenant/branches","/api/v1/branches"];
  var ASSIGNMENT_ENDPOINTS =
    [{"path":"/api/v1/access-check/security/users/__USER_ID__/branch","method":"POST"},{"path":"/api/v1/security/users/__USER_ID__/branch","method":"POST"}];

  if (typeof window.fetch !== 'function') {
    return;
  }

  var originalFetch = window.fetch.bind(window);

  var state = {
    branchId: null,
    sessionId: null,
    apiHeaders: new Headers(),
    users: [],
    branches: [],
    buttonMounted: false,
    mountingAttempts: 0
  };

  function positiveNumber(value) {
    var parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : null;
  }

  function isObject(value) {
    return (
      value !== null &&
      typeof value === 'object'
    );
  }

  function unique(items) {
    var seen = Object.create(null);

    return items.filter(function (item) {
      var id = positiveNumber(item && item.id);

      if (!id || seen[id]) {
        return false;
      }

      seen[id] = true;
      return true;
    });
  }

  function uniqueStrings(items) {
    var seen = Object.create(null);

    return items.filter(function (item) {
      if (
        typeof item !== 'string' ||
        item.trim() === ''
      ) {
        return false;
      }

      var value = item.trim();

      if (seen[value]) {
        return false;
      }

      seen[value] = true;
      return true;
    });
  }

  USER_ENDPOINTS = uniqueStrings(USER_ENDPOINTS);
  BRANCH_ENDPOINTS =
    uniqueStrings(BRANCH_ENDPOINTS);

  function randomIdentifier() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === 'function'
    ) {
      return window.crypto.randomUUID();
    }

    var values = new Uint8Array(16);

    if (
      window.crypto &&
      typeof window.crypto.getRandomValues === 'function'
    ) {
      window.crypto.getRandomValues(values);
    } else {
      for (
        var index = 0;
        index < values.length;
        index += 1
      ) {
        values[index] =
          Math.floor(Math.random() * 256);
      }
    }

    return Array.prototype.map.call(
      values,
      function (value) {
        return value
          .toString(16)
          .padStart(2, '0');
      }
    ).join('');
  }

  function getTerminalIdentity() {
    try {
      var existing = JSON.parse(
        window.localStorage.getItem(
          STORAGE_KEY
        ) || 'null'
      );

      if (
        existing &&
        typeof existing.identifier === 'string' &&
        existing.identifier.trim() !== ''
      ) {
        return {
          identifier:
            existing.identifier
              .trim()
              .toLowerCase(),

          label:
            typeof existing.label === 'string' &&
            existing.label.trim() !== ''
              ? existing.label.trim()
              : 'Browser POS terminal'
        };
      }
    } catch (error) {
      console.warn(
        '[UbuzimaPlus] Invalid terminal identity.',
        error
      );
    }

    var identity = {
      identifier: (
        'web-' + randomIdentifier()
      ).slice(0, 100).toLowerCase(),

      label: (
        'Browser POS · ' +
        (
          navigator.platform ||
          navigator.userAgent ||
          'Terminal'
        )
      ).slice(0, 100),

      created_at: new Date().toISOString()
    };

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(identity)
      );
    } catch (error) {
      console.warn(
        '[UbuzimaPlus] Terminal identity could not be stored.',
        error
      );
    }

    return identity;
  }

  var terminal = getTerminalIdentity();

  function rememberHeaders(headers) {
    if (!headers) {
      return;
    }

    try {
      var source = new Headers(headers);

      source.forEach(function (value, name) {
        var lower = name.toLowerCase();

        if (
          lower === 'content-length' ||
          lower === 'host'
        ) {
          return;
        }

        state.apiHeaders.set(name, value);
      });
    } catch (error) {
      return;
    }
  }

  function endpointKind(url, method) {
    var path = url.pathname.replace(
      /\/+$/,
      ''
    );

    if (
      method === 'GET' &&
      /\/pharmaco\/pos\/session\/current$/.test(path)
    ) {
      return 'current-session';
    }

    if (
      method === 'POST' &&
      /\/pharmaco\/pos\/session\/open$/.test(path)
    ) {
      return 'open-session';
    }

    if (
      method === 'POST' &&
      /\/pharmaco\/sales\/checkout$/.test(path)
    ) {
      return 'checkout';
    }

    if (
      method === 'POST' &&
      /\/pharmaco\/pos\/session\/(?:close|zeroize)$/.test(path)
    ) {
      return 'end-session';
    }

    if (
      method === 'GET' &&
      /\/(?:security\/)?users$/.test(path)
    ) {
      return 'users';
    }

    if (
      method === 'GET' &&
      /\/branches$/.test(path)
    ) {
      return 'branches';
    }

    return 'other';
  }

  function findSession(value, depth) {
    if (
      !isObject(value) ||
      depth > 8
    ) {
      return null;
    }

    if (
      positiveNumber(value.id) &&
      (
        value.opened_at ||
        value.opened_at_utc ||
        value.terminal_identifier ||
        value.status
      )
    ) {
      return value;
    }

    var keys = Object.keys(value);

    for (
      var index = 0;
      index < keys.length;
      index += 1
    ) {
      var result = findSession(
        value[keys[index]],
        depth + 1
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  function findBestArray(
    value,
    predicate,
    depth
  ) {
    if (depth > 8 || value === null) {
      return [];
    }

    var best = [];

    if (Array.isArray(value)) {
      var matching = value.filter(predicate);

      if (matching.length > best.length) {
        best = matching;
      }

      value.forEach(function (item) {
        var nested = findBestArray(
          item,
          predicate,
          depth + 1
        );

        if (nested.length > best.length) {
          best = nested;
        }
      });

      return best;
    }

    if (!isObject(value)) {
      return best;
    }

    Object.keys(value).forEach(function (key) {
      var nested = findBestArray(
        value[key],
        predicate,
        depth + 1
      );

      if (nested.length > best.length) {
        best = nested;
      }
    });

    return best;
  }

  function extractUsers(payload) {
    return unique(
      findBestArray(
        payload,
        function (item) {
          return (
            isObject(item) &&
            positiveNumber(item.id) &&
            (
              typeof item.email === 'string' ||
              typeof item.name === 'string'
            ) &&
            typeof item.code !== 'string'
          );
        },
        0
      )
    );
  }

  function extractBranches(payload) {
    return unique(
      findBestArray(
        payload,
        function (item) {
          return (
            isObject(item) &&
            positiveNumber(item.id) &&
            typeof item.name === 'string' &&
            typeof item.email !== 'string'
          );
        },
        0
      )
    );
  }

  function captureSessionPayload(payload) {
    var session = findSession(
      payload,
      0
    );

    if (!session) {
      return;
    }

    state.sessionId =
      positiveNumber(session.id) ||
      state.sessionId;

    state.branchId =
      positiveNumber(session.branch_id) ||
      state.branchId;
  }

  async function responseJson(
    response,
    kind
  ) {
    var contentType =
      response.headers.get(
        'content-type'
      ) || '';

    if (
      contentType.indexOf(
        'application/json'
      ) === -1
    ) {
      return null;
    }

    try {
      var payload =
        await response.clone().json();

      if (
        kind === 'current-session' ||
        kind === 'open-session'
      ) {
        captureSessionPayload(payload);
      }

      if (kind === 'users') {
        var users = extractUsers(payload);

        if (users.length) {
          state.users = users;
          scheduleMount();
        }
      }

      if (kind === 'branches') {
        var branches =
          extractBranches(payload);

        if (branches.length) {
          state.branches = branches;
        }
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  async function requestJsonBody(request) {
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

  async function resolveCurrentSession(
    baseUrl,
    headers,
    branchId,
    credentials
  ) {
    if (state.sessionId) {
      return state.sessionId;
    }

    if (!branchId) {
      return null;
    }

    var currentUrl =
      new URL(baseUrl.toString());

    currentUrl.pathname =
      currentUrl.pathname.replace(
        /\/pharmaco\/sales\/checkout$/,
        '/pharmaco/pos/session/current'
      );

    currentUrl.searchParams.set(
      'branch_id',
      String(branchId)
    );

    currentUrl.searchParams.set(
      'terminal_identifier',
      terminal.identifier
    );

    try {
      var response = await originalFetch(
        currentUrl.toString(),
        {
          method: 'GET',
          headers: headers,
          credentials:
            credentials || 'same-origin',
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        return null;
      }

      var payload =
        await response.clone().json();

      captureSessionPayload(payload);

      return state.sessionId;
    } catch (error) {
      return null;
    }
  }

  window.fetch = async function (
    input,
    init
  ) {
    var request = new Request(
      input,
      init
    );

    var method =
      request.method.toUpperCase();

    var url = new URL(
      request.url,
      window.location.href
    );

    if (
      url.pathname.indexOf('/api/') !== -1
    ) {
      rememberHeaders(request.headers);
    }

    var kind =
      endpointKind(url, method);

    if (kind === 'other') {
      return originalFetch(request);
    }

    var headers =
      new Headers(request.headers);

    var payload = null;
    var changed = false;

    if (
      kind === 'current-session'
    ) {
      var queryBranch =
        positiveNumber(
          url.searchParams.get('branch_id')
        );

      if (queryBranch) {
        state.branchId = queryBranch;
      }

      if (state.branchId) {
        url.searchParams.set(
          'branch_id',
          String(state.branchId)
        );
      }

      url.searchParams.set(
        'terminal_identifier',
        terminal.identifier
      );

      changed = true;
    }

    if (
      kind === 'open-session' ||
      kind === 'checkout'
    ) {
      payload =
        await requestJsonBody(request);

      if (isObject(payload)) {
        var payloadBranch =
          positiveNumber(
            payload.branch_id
          );

        if (payloadBranch) {
          state.branchId =
            payloadBranch;
        }

        if (
          kind === 'open-session'
        ) {
          payload.terminal_identifier =
            terminal.identifier;

          payload.terminal_label =
            terminal.label;

          changed = true;
        }

        if (
          kind === 'checkout'
        ) {
          var sessionId =
            positiveNumber(
              payload.pos_session_id
            ) ||
            state.sessionId ||
            await resolveCurrentSession(
              url,
              headers,
              state.branchId,
              request.credentials
            );

          if (!sessionId) {
            throw new Error(
              'An active POS session could not be identified for this terminal.'
            );
          }

          payload.pos_session_id =
            sessionId;

          payload.terminal_identifier =
            terminal.identifier;

          changed = true;
        }
      }
    }

    var nextRequest = request;

    if (changed) {
      var options = {
        method: request.method,
        headers: headers,
        credentials:
          request.credentials,
        cache: request.cache,
        redirect: request.redirect,
        referrerPolicy:
          request.referrerPolicy,
        mode: request.mode,
        signal: request.signal,
        keepalive: request.keepalive
      };

      if (
        method !== 'GET' &&
        method !== 'HEAD'
      ) {
        headers.set(
          'Content-Type',
          'application/json'
        );

        options.headers = headers;
        options.body =
          JSON.stringify(payload);
      }

      nextRequest = new Request(
        url.toString(),
        options
      );
    }

    var response =
      await originalFetch(nextRequest);

    if (
      kind === 'end-session' &&
      response.ok
    ) {
      state.sessionId = null;
    }

    if (
      kind !== 'checkout' &&
      kind !== 'end-session'
    ) {
      await responseJson(
        response,
        kind
      );
    }

    return response;
  };

  function apiHeaders() {
    var headers = new Headers(
      state.apiHeaders
    );

    headers.delete('content-length');
    headers.delete('host');

    return headers;
  }

  function absoluteApiUrl(path) {
    return new URL(
      path,
      window.location.origin
    ).toString();
  }

  async function tryGetCandidates(
    candidates,
    kind
  ) {
    var lastError = null;

    for (
      var index = 0;
      index < candidates.length;
      index += 1
    ) {
      var endpoint =
        candidates[index];

      try {
        var response =
          await originalFetch(
            absoluteApiUrl(endpoint),
            {
              method: 'GET',
              headers: apiHeaders(),
              credentials: 'same-origin',
              cache: 'no-store'
            }
          );

        if (!response.ok) {
          lastError = new Error(
            endpoint +
            ' returned HTTP ' +
            response.status
          );

          continue;
        }

        var payload =
          await response.json();

        var items =
          kind === 'users'
            ? extractUsers(payload)
            : extractBranches(payload);

        if (items.length) {
          return items;
        }

        lastError = new Error(
          'No ' +
          kind +
          ' were returned by ' +
          endpoint
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw (
      lastError ||
      new Error(
        'No working ' +
        kind +
        ' endpoint was found.'
      )
    );
  }

  async function ensureUsers() {
    if (state.users.length) {
      return state.users;
    }

    state.users =
      await tryGetCandidates(
        USER_ENDPOINTS,
        'users'
      );

    return state.users;
  }

  async function ensureBranches() {
    if (state.branches.length) {
      return state.branches;
    }

    state.branches =
      await tryGetCandidates(
        BRANCH_ENDPOINTS,
        'branches'
      );

    return state.branches;
  }

  async function assignBranch(
    userId,
    branchId
  ) {
    var lastError = null;

    for (
      var index = 0;
      index < ASSIGNMENT_ENDPOINTS.length;
      index += 1
    ) {
      var candidate =
        ASSIGNMENT_ENDPOINTS[index];

      var endpoint =
        candidate.path.replace(
          '__USER_ID__',
          encodeURIComponent(userId)
        );

      var headers = apiHeaders();

      headers.set(
        'Content-Type',
        'application/json'
      );

      try {
        var response =
          await originalFetch(
            absoluteApiUrl(endpoint),
            {
              method:
                candidate.method ||
                'POST',

              headers: headers,
              credentials: 'same-origin',

              body: JSON.stringify({
                branch_id:
                  Number(branchId)
              })
            }
          );

        var payload = null;

        try {
          payload =
            await response.clone().json();
        } catch (error) {
          payload = null;
        }

        if (response.ok) {
          return payload;
        }

        lastError = new Error(
          payload && payload.message
            ? payload.message
            : (
              endpoint +
              ' returned HTTP ' +
              response.status
            )
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw (
      lastError ||
      new Error(
        'Branch assignment failed.'
      )
    );
  }

  function onUsersPage() {
    var locationText =
      window.location.href.toLowerCase();

    if (
      locationText.indexOf('user') !== -1 ||
      locationText.indexOf('security') !== -1 ||
      locationText.indexOf('staff') !== -1
    ) {
      return true;
    }

    if (!document.body) {
      return false;
    }

    var text =
      (
        document.body.innerText ||
        ''
      )
        .slice(0, 20000)
        .toLowerCase();

    return (
      text.indexOf(
        'users & security'
      ) !== -1 ||
      text.indexOf(
        'new staff account'
      ) !== -1 ||
      text.indexOf(
        'staff account'
      ) !== -1
    );
  }

  function style(element, rules) {
    Object.keys(rules).forEach(
      function (key) {
        element.style[key] =
          rules[key];
      }
    );

    return element;
  }

  function removeExistingButton() {
    var existing =
      document.querySelector(
        '[data-ubuzima-runtime-extension=' +
        '"branch-assignment"]'
      );

    if (existing) {
      existing.remove();
    }

    state.buttonMounted = false;
  }

  function closeModal() {
    var existing =
      document.querySelector(
        '[data-ubuzima-runtime-extension-modal=' +
        '"branch-assignment"]'
      );

    if (existing) {
      existing.remove();
    }
  }

  function openBranchModal() {
    closeModal();

    var overlay = style(
      document.createElement('div'),
      {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483646',
        background:
          'rgba(15, 23, 42, 0.58)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }
    );

    overlay.setAttribute(
      'data-ubuzima-runtime-extension-modal',
      'branch-assignment'
    );

    var card = style(
      document.createElement('div'),
      {
        width: 'min(520px, 100%)',
        maxHeight: '90vh',
        overflow: 'auto',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow:
          '0 24px 60px rgba(15, 23, 42, 0.28)',
        padding: '24px',
        fontFamily: 'inherit'
      }
    );

    var title =
      document.createElement('h2');

    title.textContent =
      'Assign staff branch';

    title.style.margin =
      '0 0 8px';

    var description =
      document.createElement('p');

    description.textContent =
      'Select the branch this staff member may use for POS activities.';

    description.style.margin =
      '0 0 18px';

    description.style.color =
      '#475569';

    var loading =
      document.createElement('p');

    loading.textContent =
      'Loading staff and branches…';

    loading.style.margin =
      '0 0 18px';

    loading.style.color =
      '#334155';

    var form =
      document.createElement('div');

    form.style.display = 'none';

    var userLabel =
      document.createElement('label');

    userLabel.textContent =
      'Staff member';

    userLabel.style.display =
      'grid';

    userLabel.style.gap =
      '8px';

    userLabel.style.marginBottom =
      '16px';

    var userSelect =
      document.createElement('select');

    var branchLabel =
      document.createElement('label');

    branchLabel.textContent =
      'Assigned branch';

    branchLabel.style.display =
      'grid';

    branchLabel.style.gap =
      '8px';

    branchLabel.style.marginBottom =
      '16px';

    var branchSelect =
      document.createElement('select');

    [
      userSelect,
      branchSelect
    ].forEach(function (select) {
      style(select, {
        width: '100%',
        minHeight: '44px',
        border:
          '1px solid #cbd5e1',
        borderRadius: '10px',
        padding: '8px 12px',
        background: '#ffffff',
        font: 'inherit'
      });
    });

    userLabel.appendChild(
      userSelect
    );

    branchLabel.appendChild(
      branchSelect
    );

    var status =
      document.createElement('p');

    status.style.minHeight =
      '24px';

    status.style.margin =
      '0 0 16px';

    var actions = style(
      document.createElement('div'),
      {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        flexWrap: 'wrap'
      }
    );

    var cancel =
      document.createElement('button');

    cancel.type = 'button';
    cancel.textContent = 'Cancel';

    var save =
      document.createElement('button');

    save.type = 'button';
    save.textContent =
      'Save branch assignment';

    [
      cancel,
      save
    ].forEach(function (button) {
      style(button, {
        minHeight: '42px',
        borderRadius: '10px',
        padding: '8px 16px',
        font: 'inherit',
        cursor: 'pointer'
      });
    });

    style(cancel, {
      border:
        '1px solid #cbd5e1',
      background: '#ffffff',
      color: '#334155'
    });

    style(save, {
      border:
        '1px solid #166534',
      background: '#166534',
      color: '#ffffff'
    });

    cancel.addEventListener(
      'click',
      closeModal
    );

    overlay.addEventListener(
      'click',
      function (event) {
        if (event.target === overlay) {
          closeModal();
        }
      }
    );

    save.addEventListener(
      'click',
      async function () {
        save.disabled = true;

        status.style.color =
          '#334155';

        status.textContent =
          'Saving branch assignment…';

        try {
          await assignBranch(
            userSelect.value,
            branchSelect.value
          );

          status.style.color =
            '#166534';

          status.textContent =
            'Branch assignment saved successfully.';

          window.setTimeout(
            closeModal,
            900
          );
        } catch (error) {
          status.style.color =
            '#b91c1c';

          status.textContent =
            error && error.message
              ? error.message
              : 'Branch assignment failed.';
        } finally {
          save.disabled = false;
        }
      }
    );

    actions.appendChild(cancel);
    actions.appendChild(save);

    form.appendChild(userLabel);
    form.appendChild(branchLabel);
    form.appendChild(status);
    form.appendChild(actions);

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(loading);
    card.appendChild(form);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    Promise.all([
      ensureUsers(),
      ensureBranches()
    ])
      .then(function (results) {
        var users = results[0];
        var branches = results[1];

        userSelect.innerHTML = '';
        branchSelect.innerHTML = '';

        users.forEach(function (user) {
          var option =
            document.createElement(
              'option'
            );

          option.value =
            String(user.id);

          option.textContent =
            user.name ||
            user.email ||
            ('User #' + user.id);

          userSelect.appendChild(
            option
          );
        });

        branches.forEach(
          function (branch) {
            var option =
              document.createElement(
                'option'
              );

            option.value =
              String(branch.id);

            option.textContent =
              branch.name +
              (
                branch.code
                  ? ' (' +
                    branch.code +
                    ')'
                  : ''
              );

            branchSelect.appendChild(
              option
            );
          }
        );

        loading.remove();
        form.style.display = 'block';
      })
      .catch(function (error) {
        loading.style.color =
          '#b91c1c';

        loading.textContent =
          error && error.message
            ? error.message
            : (
              'Staff or branch records ' +
              'could not be loaded.'
            );
      });
  }

  function mountBranchButton() {
    if (
      !document.body ||
      !onUsersPage()
    ) {
      return;
    }

    var existing =
      document.querySelector(
        '[data-ubuzima-runtime-extension=' +
        '"branch-assignment"]'
      );

    if (existing) {
      state.buttonMounted = true;
      return;
    }

    var button =
      document.createElement('button');

    button.type = 'button';

    button.textContent =
      'Assign staff branch';

    button.setAttribute(
      'data-ubuzima-runtime-extension',
      'branch-assignment'
    );

    style(button, {
      position: 'fixed',
      right: '24px',
      bottom: '24px',
      zIndex: '2147483645',
      minHeight: '44px',
      border:
        '1px solid #166534',
      borderRadius: '12px',
      padding: '10px 16px',
      background: '#166534',
      color: '#ffffff',
      boxShadow:
        '0 12px 30px rgba(15, 23, 42, 0.22)',
      font: 'inherit',
      fontWeight: '700',
      cursor: 'pointer'
    });

    button.addEventListener(
      'click',
      openBranchModal
    );

    document.body.appendChild(
      button
    );

    state.buttonMounted = true;
  }

  function scheduleMount() {
    state.mountingAttempts = 0;

    function attempt() {
      state.mountingAttempts += 1;

      if (onUsersPage()) {
        mountBranchButton();
        return;
      }

      if (
        state.mountingAttempts < 10
      ) {
        window.setTimeout(
          attempt,
          400
        );
      }
    }

    window.setTimeout(
      attempt,
      100
    );
  }

  function routeChanged() {
    if (!onUsersPage()) {
      removeExistingButton();
    }

    scheduleMount();
  }

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      scheduleMount,
      { once: true }
    );
  } else {
    scheduleMount();
  }

  window.addEventListener(
    'hashchange',
    routeChanged
  );

  window.addEventListener(
    'popstate',
    routeChanged
  );

  document.addEventListener(
    'click',
    function () {
      window.setTimeout(
        routeChanged,
        350
      );
    },
    true
  );

  window.__UBUZIMA_LIVE_POS_EXTENSION__ = {
    version: VERSION,
    terminal: terminal,

    diagnostics: function () {
      return {
        version: VERSION,
        branch_id:
          state.branchId,
        pos_session_id:
          state.sessionId,
        terminal_identifier:
          terminal.identifier,
        users_loaded:
          state.users.length,
        branches_loaded:
          state.branches.length,
        continuous_dom_observer:
          false,
        continuous_interval:
          false
      };
    }
  };

  console.info(
    '[UbuzimaPlus] Optimized live UI extension loaded.',
    VERSION
  );
}());

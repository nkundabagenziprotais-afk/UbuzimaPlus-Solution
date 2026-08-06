(function () {
  'use strict';

  if (window.__UBUZIMA_LIVE_POS_EXTENSION__) {
    return;
  }

  var VERSION = '2026.08-live-runtime-extension';
  var STORAGE_KEY = 'ubuzima.pos.terminal.identity.v1';

  if (typeof window.fetch !== 'function') {
    console.error(
      '[UbuzimaPlus] Fetch API is unavailable. POS extension was not loaded.'
    );

    return;
  }

  var originalFetch = window.fetch.bind(window);

  var state = {
    branchId: null,
    sessionId: null,
    usersEndpoint: null,
    usersHeaders: null,
    users: [],
    branches: [],
    panelMounted: false
  };

  function normaliseNumber(value) {
    var parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : null;
  }

  function isObject(value) {
    return value !== null && typeof value === 'object';
  }

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
      for (var index = 0; index < values.length; index += 1) {
        values[index] = Math.floor(Math.random() * 256);
      }
    }

    return Array.prototype.map.call(
      values,
      function (value) {
        return value.toString(16).padStart(2, '0');
      }
    ).join('');
  }

  function getTerminalIdentity() {
    try {
      var existing = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) || 'null'
      );

      if (
        existing &&
        typeof existing.identifier === 'string' &&
        existing.identifier.trim() !== ''
      ) {
        return {
          identifier: existing.identifier.trim().toLowerCase(),
          label:
            typeof existing.label === 'string' &&
            existing.label.trim() !== ''
              ? existing.label.trim()
              : 'Browser POS terminal'
        };
      }
    } catch (error) {
      console.warn(
        '[UbuzimaPlus] Invalid stored POS terminal identity.',
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
        '[UbuzimaPlus] POS terminal identity could not be stored.',
        error
      );
    }

    return identity;
  }

  var terminal = getTerminalIdentity();

  function uniqueById(items) {
    var seen = Object.create(null);

    return items.filter(function (item) {
      var id = normaliseNumber(item && item.id);

      if (!id || seen[id]) {
        return false;
      }

      seen[id] = true;
      return true;
    });
  }

  function branchFromAssignments(assignments) {
    if (!Array.isArray(assignments)) {
      return null;
    }

    var active = assignments.find(function (assignment) {
      return (
        isObject(assignment) &&
        isObject(assignment.branch) &&
        normaliseNumber(assignment.branch.id) &&
        (
          assignment.status === 'active' ||
          assignment.status === undefined ||
          assignment.status === null
        )
      );
    });

    if (active) {
      return normaliseNumber(active.branch.id);
    }

    var assigned = assignments.find(function (assignment) {
      return (
        isObject(assignment) &&
        isObject(assignment.branch) &&
        normaliseNumber(assignment.branch.id)
      );
    });

    return assigned
      ? normaliseNumber(assigned.branch.id)
      : null;
  }

  function schedulePanel() {
    window.clearTimeout(schedulePanel.timer);

    schedulePanel.timer = window.setTimeout(
      mountBranchButton,
      150
    );
  }

  function inspectJson(value, hint, depth, visited) {
    if (!isObject(value) || depth > 10) {
      return;
    }

    if (visited.indexOf(value) !== -1) {
      return;
    }

    visited.push(value);

    if (
      isObject(value.scope) &&
      normaliseNumber(value.scope.branch_id)
    ) {
      state.branchId = normaliseNumber(
        value.scope.branch_id
      );
    }

    var assignmentBranch = branchFromAssignments(
      value.tenant_assignments
    );

    if (assignmentBranch) {
      state.branchId = assignmentBranch;
    }

    if (
      normaliseNumber(value.branch_id) &&
      (
        hint === 'session' ||
        hint === 'profile'
      )
    ) {
      state.branchId = normaliseNumber(
        value.branch_id
      );
    }

    if (
      hint === 'session' &&
      normaliseNumber(value.id) &&
      (
        value.opened_at ||
        value.opened_at_utc ||
        value.terminal_identifier ||
        value.status
      )
    ) {
      state.sessionId = normaliseNumber(value.id);
    }

    Object.keys(value).forEach(function (key) {
      var child = value[key];

      if (key === 'branches' && Array.isArray(child)) {
        state.branches = uniqueById(
          state.branches.concat(
            child.filter(function (branch) {
              return (
                isObject(branch) &&
                normaliseNumber(branch.id) &&
                typeof branch.name === 'string'
              );
            })
          )
        );
      }

      if (key === 'users' && Array.isArray(child)) {
        state.users = uniqueById(
          child.filter(function (user) {
            return (
              isObject(user) &&
              normaliseNumber(user.id) &&
              (
                typeof user.name === 'string' ||
                typeof user.email === 'string'
              )
            );
          })
        );
      }

      if (isObject(child)) {
        inspectJson(
          child,
          (
            key === 'session' ||
            key === 'current_session'
          )
            ? 'session'
            : hint,
          depth + 1,
          visited
        );
      }
    });

    schedulePanel();
  }

  function endpointKind(url, method) {
    var path = url.pathname.replace(/\/+$/, '');

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
      method === 'GET' &&
      /\/security\/users$/.test(path)
    ) {
      return 'security-users';
    }

    if (
      method === 'POST' &&
      /\/security\/users\/\d+\/branch$/.test(path)
    ) {
      return 'branch-assignment';
    }

    if (
      method === 'POST' &&
      /\/pharmaco\/pos\/session\/(?:close|zeroize)$/.test(path)
    ) {
      return 'end-session';
    }

    return 'other';
  }

  function findSessionId(value, depth) {
    if (!isObject(value) || depth > 8) {
      return null;
    }

    if (
      normaliseNumber(value.id) &&
      (
        value.opened_at ||
        value.opened_at_utc ||
        value.terminal_identifier ||
        value.status
      )
    ) {
      return normaliseNumber(value.id);
    }

    var keys = Object.keys(value);

    for (var index = 0; index < keys.length; index += 1) {
      var result = findSessionId(
        value[keys[index]],
        depth + 1
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  async function parseRequestJson(request) {
    var method = request.method.toUpperCase();

    if (method === 'GET' || method === 'HEAD') {
      return null;
    }

    try {
      var text = await request.clone().text();

      if (!text || text.trim() === '') {
        return null;
      }

      var contentType =
        request.headers.get('content-type') || '';

      if (
        contentType.indexOf('application/json') !== -1 ||
        text.trim().charAt(0) === '{'
      ) {
        return JSON.parse(text);
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  async function captureResponse(response, kind) {
    var contentType =
      response.headers.get('content-type') || '';

    if (
      contentType.indexOf('application/json') === -1
    ) {
      return;
    }

    try {
      var data = await response.clone().json();

      inspectJson(
        data,
        (
          kind === 'current-session' ||
          kind === 'open-session'
        )
          ? 'session'
          : 'profile',
        0,
        []
      );

      if (
        kind === 'current-session' ||
        kind === 'open-session'
      ) {
        var sessionId = findSessionId(data, 0);

        if (sessionId) {
          state.sessionId = sessionId;
        }
      }

      if (kind === 'end-session') {
        state.sessionId = null;
      }
    } catch (error) {
      console.warn(
        '[UbuzimaPlus] Runtime response inspection failed.',
        error
      );
    }
  }

  async function resolveCurrentSession(
    checkoutUrl,
    headers,
    branchId,
    request
  ) {
    if (state.sessionId) {
      return state.sessionId;
    }

    if (!branchId) {
      return null;
    }

    var currentUrl = new URL(
      checkoutUrl.toString()
    );

    currentUrl.pathname = currentUrl.pathname.replace(
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
            request.credentials || 'same-origin',
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        return null;
      }

      var data = await response.clone().json();
      var sessionId = findSessionId(data, 0);

      if (sessionId) {
        state.sessionId = sessionId;
      }

      inspectJson(data, 'session', 0, []);

      return sessionId;
    } catch (error) {
      console.warn(
        '[UbuzimaPlus] Current POS session lookup failed.',
        error
      );

      return null;
    }
  }

  window.fetch = async function (input, init) {
    var request = new Request(input, init);
    var method = request.method.toUpperCase();

    var url = new URL(
      request.url,
      window.location.href
    );

    var headers = new Headers(request.headers);
    var kind = endpointKind(url, method);
    var payload = await parseRequestJson(request);
    var changed = false;

    if (kind === 'security-users') {
      state.usersEndpoint =
        url.origin + url.pathname.replace(/\/+$/, '');

      state.usersHeaders = new Headers(headers);
    }

    if (
      kind === 'current-session' &&
      state.branchId
    ) {
      url.searchParams.set(
        'branch_id',
        String(state.branchId)
      );

      url.searchParams.set(
        'terminal_identifier',
        terminal.identifier
      );

      changed = true;
    }

    if (
      kind === 'open-session' &&
      isObject(payload)
    ) {
      var openingBranch = normaliseNumber(
        payload.branch_id
      );

      if (openingBranch) {
        state.branchId = openingBranch;
      }

      payload.terminal_identifier =
        terminal.identifier;

      payload.terminal_label =
        terminal.label;

      changed = true;
    }

    if (
      kind === 'checkout' &&
      isObject(payload)
    ) {
      var checkoutBranch =
        normaliseNumber(payload.branch_id) ||
        state.branchId;

      if (checkoutBranch) {
        state.branchId = checkoutBranch;
      }

      var sessionId =
        normaliseNumber(payload.pos_session_id) ||
        state.sessionId ||
        await resolveCurrentSession(
          url,
          headers,
          checkoutBranch,
          request
        );

      if (!sessionId) {
        throw new Error(
          'The active POS session could not be identified for this terminal.'
        );
      }

      payload.pos_session_id = sessionId;
      payload.terminal_identifier =
        terminal.identifier;

      changed = true;
    }

    var nextRequest = request;

    if (changed) {
      var options = {
        method: request.method,
        headers: headers,
        credentials: request.credentials,
        cache: request.cache,
        redirect: request.redirect,
        referrerPolicy: request.referrerPolicy,
        mode: request.mode,
        signal: request.signal,
        keepalive: request.keepalive
      };

      if (
        method !== 'GET' &&
        method !== 'HEAD'
      ) {
        if (isObject(payload)) {
          headers.set(
            'Content-Type',
            'application/json'
          );

          options.headers = headers;
          options.body = JSON.stringify(payload);
        } else {
          options.body =
            await request.clone().blob();
        }
      }

      nextRequest = new Request(
        url.toString(),
        options
      );
    }

    var response = await originalFetch(nextRequest);

    await captureResponse(response, kind);

    return response;
  };

  if (
    window.XMLHttpRequest &&
    XMLHttpRequest.prototype
  ) {
    var xhrOpen =
      XMLHttpRequest.prototype.open;

    var xhrSend =
      XMLHttpRequest.prototype.send;

    var xhrSetRequestHeader =
      XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function (
      method,
      url
    ) {
      var args = Array.prototype.slice.call(
        arguments
      );

      var parsed = new URL(
        url,
        window.location.href
      );

      var kind = endpointKind(
        parsed,
        String(method).toUpperCase()
      );

      if (
        kind === 'current-session' &&
        state.branchId
      ) {
        parsed.searchParams.set(
          'branch_id',
          String(state.branchId)
        );

        parsed.searchParams.set(
          'terminal_identifier',
          terminal.identifier
        );

        args[1] = parsed.toString();
      }

      this.__ubuzimaExtension = {
        method: String(method).toUpperCase(),
        url: parsed,
        kind: kind,
        headers: {},
        async: args.length < 3 || args[2] !== false
      };

      return xhrOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.setRequestHeader =
      function (name, value) {
        if (this.__ubuzimaExtension) {
          this.__ubuzimaExtension.headers[name] = value;
        }

        return xhrSetRequestHeader.apply(
          this,
          arguments
        );
      };

    XMLHttpRequest.prototype.send = function (body) {
      var xhr = this;
      var context = xhr.__ubuzimaExtension;

      function finish(nextBody) {
        xhr.addEventListener(
          'load',
          function () {
            try {
              var contentType =
                xhr.getResponseHeader(
                  'content-type'
                ) || '';

              if (
                contentType.indexOf(
                  'application/json'
                ) !== -1
              ) {
                var data = JSON.parse(
                  xhr.responseText
                );

                inspectJson(
                  data,
                  (
                    context.kind === 'current-session' ||
                    context.kind === 'open-session'
                  )
                    ? 'session'
                    : 'profile',
                  0,
                  []
                );

                if (
                  context.kind === 'current-session' ||
                  context.kind === 'open-session'
                ) {
                  var sessionId =
                    findSessionId(data, 0);

                  if (sessionId) {
                    state.sessionId = sessionId;
                  }
                }

                if (context.kind === 'end-session') {
                  state.sessionId = null;
                }
              }
            } catch (error) {
              console.warn(
                '[UbuzimaPlus] XHR response inspection failed.',
                error
              );
            }
          },
          { once: true }
        );

        xhrSend.call(xhr, nextBody);
      }

      if (!context || typeof body !== 'string') {
        finish(body);
        return;
      }

      var payload;

      try {
        payload = JSON.parse(body);
      } catch (error) {
        finish(body);
        return;
      }

      if (
        context.kind === 'open-session' &&
        isObject(payload)
      ) {
        state.branchId =
          normaliseNumber(payload.branch_id) ||
          state.branchId;

        payload.terminal_identifier =
          terminal.identifier;

        payload.terminal_label =
          terminal.label;

        finish(JSON.stringify(payload));
        return;
      }

      if (
        context.kind === 'checkout' &&
        isObject(payload)
      ) {
        var branchId =
          normaliseNumber(payload.branch_id) ||
          state.branchId;

        var existingSession =
          normaliseNumber(payload.pos_session_id) ||
          state.sessionId;

        if (existingSession) {
          payload.pos_session_id =
            existingSession;

          payload.terminal_identifier =
            terminal.identifier;

          finish(JSON.stringify(payload));
          return;
        }

        if (context.async && branchId) {
          var headers = new Headers();

          Object.keys(
            context.headers
          ).forEach(function (name) {
            headers.set(
              name,
              context.headers[name]
            );
          });

          resolveCurrentSession(
            context.url,
            headers,
            branchId,
            {
              credentials: 'same-origin'
            }
          ).then(function (sessionId) {
            if (!sessionId) {
              console.error(
                '[UbuzimaPlus] Active POS session could not be resolved.'
              );

              finish(body);
              return;
            }

            payload.pos_session_id =
              sessionId;

            payload.terminal_identifier =
              terminal.identifier;

            finish(JSON.stringify(payload));
          });

          return;
        }
      }

      finish(body);
    };
  }

  function onUserManagementPage() {
    var text = (
      document.body &&
      document.body.innerText
    )
      ? document.body.innerText
          .slice(0, 30000)
          .toLowerCase()
      : '';

    return (
      text.indexOf('users & security') !== -1 ||
      text.indexOf('new staff account') !== -1 ||
      text.indexOf('staff account') !== -1
    );
  }

  function style(element, rules) {
    Object.keys(rules).forEach(function (key) {
      element.style[key] = rules[key];
    });

    return element;
  }

  function userLabel(user) {
    return (
      user.name ||
      user.email ||
      ('User #' + user.id)
    );
  }

  function branchLabel(branch) {
    return (
      branch.name +
      (
        branch.code
          ? ' (' + branch.code + ')'
          : ''
      )
    );
  }

  async function assignBranch(
    userId,
    branchId,
    status
  ) {
    if (
      !state.usersEndpoint ||
      !state.usersHeaders
    ) {
      throw new Error(
        'Reload the Users & Security register before assigning a branch.'
      );
    }

    var endpoint =
      state.usersEndpoint +
      '/' +
      userId +
      '/branch';

    var headers = new Headers(
      state.usersHeaders
    );

    headers.set(
      'Content-Type',
      'application/json'
    );

    status.textContent =
      'Saving branch assignment…';

    var response = await originalFetch(
      endpoint,
      {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          branch_id: Number(branchId)
        })
      }
    );

    var data = null;

    try {
      data = await response.clone().json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data && data.message
          ? data.message
          : 'Branch assignment failed.'
      );
    }

    inspectJson(data, 'profile', 0, []);

    status.textContent =
      'Branch assignment saved successfully.';
  }

  function openBranchModal() {
    var existing = document.querySelector(
      '[data-ubuzima-runtime-extension-modal="branch-assignment"]'
    );

    if (existing) {
      existing.remove();
    }

    var overlay = style(
      document.createElement('div'),
      {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483646',
        background: 'rgba(15, 23, 42, 0.58)',
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

    var title = document.createElement('h2');
    title.textContent = 'Assign staff branch';
    title.style.margin = '0 0 8px';

    var description =
      document.createElement('p');

    description.textContent =
      'Select the operating branch this staff member may use for POS activities.';

    description.style.margin = '0 0 20px';
    description.style.color = '#475569';

    var userLabelElement =
      document.createElement('label');

    userLabelElement.textContent =
      'Staff member';

    userLabelElement.style.display = 'grid';
    userLabelElement.style.gap = '8px';
    userLabelElement.style.marginBottom = '16px';

    var userSelect =
      document.createElement('select');

    var branchLabelElement =
      document.createElement('label');

    branchLabelElement.textContent =
      'Assigned branch';

    branchLabelElement.style.display = 'grid';
    branchLabelElement.style.gap = '8px';
    branchLabelElement.style.marginBottom = '16px';

    var branchSelect =
      document.createElement('select');

    [userSelect, branchSelect].forEach(
      function (select) {
        style(select, {
          width: '100%',
          minHeight: '44px',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '8px 12px',
          background: '#ffffff',
          font: 'inherit'
        });
      }
    );

    state.users.forEach(function (user) {
      var option =
        document.createElement('option');

      option.value = String(user.id);

      option.textContent =
        userLabel(user) +
        (
          user.branch && user.branch.name
            ? ' · ' + user.branch.name
            : ' · Not assigned'
        );

      userSelect.appendChild(option);
    });

    state.branches.forEach(function (branch) {
      var option =
        document.createElement('option');

      option.value = String(branch.id);
      option.textContent =
        branchLabel(branch);

      branchSelect.appendChild(option);
    });

    userLabelElement.appendChild(userSelect);
    branchLabelElement.appendChild(branchSelect);

    var status =
      document.createElement('p');

    status.style.minHeight = '24px';
    status.style.margin = '0 0 16px';
    status.style.color = '#334155';

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

    [cancel, save].forEach(
      function (button) {
        style(button, {
          minHeight: '42px',
          borderRadius: '10px',
          padding: '8px 16px',
          font: 'inherit',
          cursor: 'pointer'
        });
      }
    );

    style(cancel, {
      border: '1px solid #cbd5e1',
      background: '#ffffff',
      color: '#334155'
    });

    style(save, {
      border: '1px solid #166534',
      background: '#166534',
      color: '#ffffff'
    });

    cancel.addEventListener(
      'click',
      function () {
        overlay.remove();
      }
    );

    overlay.addEventListener(
      'click',
      function (event) {
        if (event.target === overlay) {
          overlay.remove();
        }
      }
    );

    save.addEventListener(
      'click',
      async function () {
        save.disabled = true;

        try {
          await assignBranch(
            userSelect.value,
            branchSelect.value,
            status
          );

          window.setTimeout(
            function () {
              overlay.remove();
            },
            900
          );
        } catch (error) {
          status.textContent =
            error && error.message
              ? error.message
              : 'Branch assignment failed.';

          status.style.color = '#b91c1c';
        } finally {
          save.disabled = false;
        }
      }
    );

    actions.appendChild(cancel);
    actions.appendChild(save);

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(userLabelElement);
    card.appendChild(branchLabelElement);
    card.appendChild(status);
    card.appendChild(actions);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  function mountBranchButton() {
    if (
      state.panelMounted ||
      !document.body ||
      !onUserManagementPage() ||
      !state.usersEndpoint ||
      !state.users.length ||
      !state.branches.length
    ) {
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
      border: '1px solid #166534',
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

    document.body.appendChild(button);
    state.panelMounted = true;
  }

  function beginUiObservation() {
    schedulePanel();

    var observer =
      new MutationObserver(function () {
        if (
          state.panelMounted &&
          !document.querySelector(
            '[data-ubuzima-runtime-extension="branch-assignment"]'
          )
        ) {
          state.panelMounted = false;
        }

        schedulePanel();
      });

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );

    window.addEventListener(
      'hashchange',
      schedulePanel
    );

    window.setInterval(
      schedulePanel,
      1500
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      beginUiObservation,
      { once: true }
    );
  } else {
    beginUiObservation();
  }

  window.__UBUZIMA_LIVE_POS_EXTENSION__ = {
    version: VERSION,
    terminal: terminal,

    diagnostics: function () {
      return {
        branch_id: state.branchId,
        pos_session_id: state.sessionId,
        terminal_identifier:
          terminal.identifier,
        users_loaded:
          state.users.length,
        branches_loaded:
          state.branches.length
      };
    }
  };

  console.info(
    '[UbuzimaPlus] Live UI POS runtime extension loaded.',
    VERSION
  );
}());

(function () {
  'use strict';

  if (window.__UBUZIMA_BRANCH_ASSIGNMENT_V3__) {
    return;
  }

  var VERSION = '2026.08.branch-assignment-v3';

  var USERS_PATH =
    '/api/v1/access-check/security/users';

  var BRANCHES_PATH =
    '/api/v1/pharmaco/branches';

  var BUTTON_ID =
    'ubuzima-assign-staff-branch-v3';

  var MODAL_ID =
    'ubuzima-assign-staff-branch-modal-v3';

  if (typeof window.fetch !== 'function') {
    return;
  }

  var originalFetch =
    window.fetch.bind(window);

  var state = {
    usersUrl: null,
    requestHeaders: null,
    credentials: 'same-origin',
    users: [],
    branches: [],
    buttonMounted: false,
    lastVerified: false,
    lastAssignedUserId: null,
    lastAssignedBranchId: null
  };

  function isObject(value) {
    return (
      value !== null &&
      typeof value === 'object'
    );
  }

  function positiveInteger(value) {
    var parsed = Number(value);

    return (
      Number.isInteger(parsed) &&
      parsed > 0
    )
      ? parsed
      : null;
  }

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

  function requestMethod(input, init) {
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

  function isExactUsersIndex(url) {
    return (
      url.pathname.replace(/\/+$/, '') ===
      USERS_PATH
    );
  }

  function cloneSafeHeaders(headers) {
    var copied = new Headers(headers);

    copied.delete('content-length');
    copied.delete('host');

    return copied;
  }

  function arrayFromPayload(
    payload,
    preferredKey
  ) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!isObject(payload)) {
      return [];
    }

    if (
      Array.isArray(
        payload[preferredKey]
      )
    ) {
      return payload[preferredKey];
    }

    if (
      isObject(payload.data) &&
      Array.isArray(
        payload.data[preferredKey]
      )
    ) {
      return payload.data[preferredKey];
    }

    if (Array.isArray(payload.data)) {
      return payload.data;
    }

    return [];
  }

  function normaliseUsers(payload) {
    return arrayFromPayload(
      payload,
      'users'
    ).filter(function (user) {
      return (
        isObject(user) &&
        positiveInteger(user.id) &&
        (
          typeof user.name === 'string' ||
          typeof user.email === 'string'
        )
      );
    });
  }

  function normaliseBranches(payload) {
    return arrayFromPayload(
      payload,
      'branches'
    ).filter(function (branch) {
      return (
        isObject(branch) &&
        positiveInteger(branch.id) &&
        typeof branch.name === 'string' &&
        (
          branch.status === undefined ||
          branch.status === null ||
          branch.status === 'active'
        )
      );
    });
  }

  function branchIdForUser(user) {
    if (!isObject(user)) {
      return null;
    }

    var candidates = [
      user.branch &&
        user.branch.id,

      user.branch_id,

      user.assignment &&
        user.assignment.branch_id,

      user.tenant_assignment &&
        user.tenant_assignment.branch_id
    ];

    if (
      Array.isArray(
        user.tenant_assignments
      )
    ) {
      user.tenant_assignments.forEach(
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
        positiveInteger(
          candidates[index]
        );

      if (branchId) {
        return branchId;
      }
    }

    return null;
  }

  function userLabel(user) {
    var identity =
      user.name ||
      user.email ||
      ('User #' + user.id);

    var branchName =
      user.branch &&
      user.branch.name;

    return branchName
      ? identity + ' · ' + branchName
      : identity + ' · Not assigned';
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

  function apiUrl(path) {
    if (!state.usersUrl) {
      throw new Error(
        'Open Users & Security and allow the user register to load first.'
      );
    }

    return new URL(
      path,
      state.usersUrl
    ).toString();
  }

  function apiHeaders(jsonRequest) {
    if (!state.requestHeaders) {
      throw new Error(
        'The authenticated Users & Security request has not been captured.'
      );
    }

    var headers =
      cloneSafeHeaders(
        state.requestHeaders
      );

    headers.set(
      'Accept',
      'application/json'
    );

    if (jsonRequest) {
      headers.set(
        'Content-Type',
        'application/json'
      );
    }

    return headers;
  }

  async function readError(response) {
    try {
      var payload =
        await response.clone().json();

      if (
        payload &&
        typeof payload.message === 'string'
      ) {
        return payload.message;
      }

      if (
        payload &&
        isObject(payload.errors)
      ) {
        return Object.keys(
          payload.errors
        ).map(function (key) {
          var value =
            payload.errors[key];

          return Array.isArray(value)
            ? value.join(' ')
            : String(value);
        }).join(' ');
      }
    } catch (error) {
      return (
        'Request failed with HTTP ' +
        response.status +
        '.'
      );
    }

    return (
      'Request failed with HTTP ' +
      response.status +
      '.'
    );
  }

  async function getJson(path) {
    var response =
      await originalFetch(
        apiUrl(path),
        {
          method: 'GET',
          headers: apiHeaders(false),
          credentials:
            state.credentials,
          cache: 'no-store'
        }
      );

    if (!response.ok) {
      throw new Error(
        await readError(response)
      );
    }

    return response.json();
  }

  async function reloadUsers() {
    var payload =
      await getJson(USERS_PATH);

    state.users =
      normaliseUsers(payload);

    return state.users;
  }

  async function loadBranches() {
    var payload =
      await getJson(BRANCHES_PATH);

    state.branches =
      normaliseBranches(payload);

    return state.branches;
  }

  async function assignBranchVerified(
    userId,
    branchId
  ) {
    var numericUserId =
      positiveInteger(userId);

    var numericBranchId =
      positiveInteger(branchId);

    if (
      !numericUserId ||
      !numericBranchId
    ) {
      throw new Error(
        'Select a valid staff member and branch.'
      );
    }

    state.lastVerified = false;

    var response =
      await originalFetch(
        apiUrl(
          USERS_PATH +
          '/' +
          encodeURIComponent(
            String(numericUserId)
          ) +
          '/branch'
        ),
        {
          method: 'POST',
          headers: apiHeaders(true),
          credentials:
            state.credentials,
          body: JSON.stringify({
            branch_id:
              numericBranchId
          })
        }
      );

    if (!response.ok) {
      throw new Error(
        await readError(response)
      );
    }

    var refreshedUsers =
      await reloadUsers();

    var refreshedUser =
      refreshedUsers.find(
        function (user) {
          return (
            Number(user.id) ===
            numericUserId
          );
        }
      );

    if (!refreshedUser) {
      throw new Error(
        'The assignment request succeeded, but the staff member was not returned during verification.'
      );
    }

    var persistedBranchId =
      branchIdForUser(
        refreshedUser
      );

    if (
      Number(persistedBranchId) !==
      numericBranchId
    ) {
      throw new Error(
        'The assignment request succeeded, but the saved branch could not be verified.'
      );
    }

    state.lastVerified = true;
    state.lastAssignedUserId =
      numericUserId;
    state.lastAssignedBranchId =
      numericBranchId;

    return {
      user: refreshedUser,
      branch_id: numericBranchId,
      verified: true
    };
  }

  function setStyles(
    element,
    styles
  ) {
    Object.keys(styles).forEach(
      function (key) {
        element.style[key] =
          styles[key];
      }
    );

    return element;
  }

  function removeModal() {
    var modal =
      document.getElementById(
        MODAL_ID
      );

    if (modal) {
      modal.remove();
    }
  }

  function createButton(
    label,
    primary
  ) {
    var button =
      document.createElement(
        'button'
      );

    button.type = 'button';
    button.textContent = label;

    setStyles(button, {
      minHeight: '42px',
      borderRadius: '10px',
      padding: '9px 16px',
      font: 'inherit',
      fontWeight:
        primary ? '700' : '600',
      cursor: 'pointer',
      border:
        primary
          ? '1px solid #166534'
          : '1px solid #cbd5e1',
      background:
        primary
          ? '#166534'
          : '#ffffff',
      color:
        primary
          ? '#ffffff'
          : '#334155'
    });

    return button;
  }

  function createSelect() {
    var select =
      document.createElement(
        'select'
      );

    setStyles(select, {
      width: '100%',
      minHeight: '44px',
      border:
        '1px solid #cbd5e1',
      borderRadius: '10px',
      padding: '9px 12px',
      background: '#ffffff',
      color: '#0f172a',
      font: 'inherit'
    });

    return select;
  }

  function createField(
    labelText,
    select
  ) {
    var label =
      document.createElement(
        'label'
      );

    label.textContent =
      labelText;

    setStyles(label, {
      display: 'grid',
      gap: '8px',
      marginBottom: '16px',
      color: '#0f172a',
      fontWeight: '600'
    });

    label.appendChild(select);

    return label;
  }

  function openModal() {
    removeModal();

    var overlay =
      document.createElement(
        'div'
      );

    overlay.id = MODAL_ID;

    setStyles(overlay, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '18px',
      background:
        'rgba(15, 23, 42, 0.60)'
    });

    var card =
      document.createElement(
        'div'
      );

    setStyles(card, {
      width: 'min(540px, 100%)',
      maxHeight: '90vh',
      overflow: 'auto',
      borderRadius: '16px',
      padding: '24px',
      background: '#ffffff',
      boxShadow:
        '0 24px 70px rgba(15, 23, 42, 0.32)',
      fontFamily: 'inherit'
    });

    var title =
      document.createElement('h2');

    title.textContent =
      'Assign staff branch';

    setStyles(title, {
      margin: '0 0 8px',
      color: '#0f172a',
      fontSize: '1.25rem'
    });

    var description =
      document.createElement('p');

    description.textContent =
      'Select the operating branch this staff member may use for POS activities.';

    setStyles(description, {
      margin: '0 0 20px',
      color: '#475569',
      lineHeight: '1.5'
    });

    var loading =
      document.createElement('p');

    loading.textContent =
      'Loading staff and active branches…';

    setStyles(loading, {
      margin: '0 0 18px',
      color: '#334155'
    });

    var form =
      document.createElement('div');

    form.style.display = 'none';

    var userSelect =
      createSelect();

    var branchSelect =
      createSelect();

    var status =
      document.createElement('p');

    setStyles(status, {
      minHeight: '24px',
      margin: '0 0 16px',
      color: '#334155',
      lineHeight: '1.45'
    });

    var actions =
      document.createElement('div');

    setStyles(actions, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      flexWrap: 'wrap'
    });

    var cancel =
      createButton(
        'Cancel',
        false
      );

    var save =
      createButton(
        'Save branch assignment',
        true
      );

    cancel.addEventListener(
      'click',
      removeModal
    );

    overlay.addEventListener(
      'click',
      function (event) {
        if (event.target === overlay) {
          removeModal();
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
          'Saving and verifying branch assignment…';

        try {
          await assignBranchVerified(
            userSelect.value,
            branchSelect.value
          );

          status.style.color =
            '#166534';

          status.textContent =
            'Branch assignment saved and verified successfully.';

          window.setTimeout(
            removeModal,
            1200
          );
        } catch (error) {
          status.style.color =
            '#b91c1c';

          status.textContent =
            error &&
            error.message
              ? error.message
              : 'Branch assignment failed.';
        } finally {
          save.disabled = false;
        }
      }
    );

    actions.appendChild(cancel);
    actions.appendChild(save);

    form.appendChild(
      createField(
        'Staff member',
        userSelect
      )
    );

    form.appendChild(
      createField(
        'Assigned branch',
        branchSelect
      )
    );

    form.appendChild(status);
    form.appendChild(actions);

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(loading);
    card.appendChild(form);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    Promise.all([
      reloadUsers(),
      loadBranches()
    ]).then(function (results) {
      var users = results[0];
      var branches = results[1];

      if (!users.length) {
        throw new Error(
          'No staff accounts were returned.'
        );
      }

      if (!branches.length) {
        throw new Error(
          'No active branches were returned.'
        );
      }

      users.forEach(
        function (user) {
          var option =
            document.createElement(
              'option'
            );

          option.value =
            String(user.id);

          option.textContent =
            userLabel(user);

          userSelect.appendChild(
            option
          );
        }
      );

      branches.forEach(
        function (branch) {
          var option =
            document.createElement(
              'option'
            );

          option.value =
            String(branch.id);

          option.textContent =
            branchLabel(branch);

          branchSelect.appendChild(
            option
          );
        }
      );

      userSelect.addEventListener(
        'change',
        function () {
          var selectedUser =
            state.users.find(
              function (user) {
                return (
                  Number(user.id) ===
                  Number(
                    userSelect.value
                  )
                );
              }
            );

          var currentBranchId =
            branchIdForUser(
              selectedUser
            );

          if (currentBranchId) {
            branchSelect.value =
              String(
                currentBranchId
              );
          }
        }
      );

      userSelect.dispatchEvent(
        new Event('change')
      );

      loading.remove();
      form.style.display = 'block';
    }).catch(function (error) {
      loading.style.color =
        '#b91c1c';

      loading.textContent =
        error &&
        error.message
          ? error.message
          : (
            'Staff and branch records ' +
            'could not be loaded.'
          );
    });
  }

  function mountButton() {
    if (!document.body) {
      document.addEventListener(
        'DOMContentLoaded',
        mountButton,
        { once: true }
      );

      return;
    }

    var existing =
      document.getElementById(
        BUTTON_ID
      );

    if (existing) {
      state.buttonMounted = true;
      return;
    }

    var button =
      document.createElement(
        'button'
      );

    button.id = BUTTON_ID;
    button.type = 'button';

    button.textContent =
      'Assign staff branch';

    button.setAttribute(
      'aria-label',
      'Assign staff branch'
    );

    button.setAttribute(
      'data-ubuzima-branch-action',
      'v3'
    );

    setStyles(button, {
      position: 'fixed',
      right: '24px',
      bottom: '92px',
      zIndex: '2147483646',
      minHeight: '46px',
      border:
        '1px solid #166534',
      borderRadius: '12px',
      padding: '10px 17px',
      background: '#166534',
      color: '#ffffff',
      boxShadow:
        '0 12px 32px rgba(15, 23, 42, 0.28)',
      font: 'inherit',
      fontWeight: '700',
      cursor: 'pointer'
    });

    button.addEventListener(
      'click',
      openModal
    );

    document.body.appendChild(
      button
    );

    state.buttonMounted = true;
  }

  function captureUsersResponse(
    request,
    response
  ) {
    state.usersUrl =
      request.url;

    state.requestHeaders =
      cloneSafeHeaders(
        request.headers
      );

    state.credentials =
      request.credentials ||
      'same-origin';

    var copiedResponse =
      response.clone();

    Promise.resolve()
      .then(function () {
        return copiedResponse.json();
      })
      .then(function (payload) {
        state.users =
          normaliseUsers(payload);

        if (
          typeof window
            .requestAnimationFrame ===
          'function'
        ) {
          window.requestAnimationFrame(
            mountButton
          );
        } else {
          mountButton();
        }
      })
      .catch(function (error) {
        console.warn(
          '[UbuzimaPlus] Users & Security branch action could not read the staff register.',
          error
        );
      });
  }

  window.fetch = function (
    input,
    init
  ) {
    var rough =
      roughUrl(input);

    /*
     * Critical performance boundary:
     * Every unrelated request—including inventory—returns
     * directly to the original live fetch implementation.
     */
    if (
      rough.indexOf(
        '/access-check/security/users'
      ) === -1
    ) {
      return originalFetch(
        input,
        init
      );
    }

    if (
      requestMethod(
        input,
        init
      ) !== 'GET'
    ) {
      return originalFetch(
        input,
        init
      );
    }

    var request =
      new Request(
        input,
        init
      );

    var url =
      new URL(
        request.url,
        window.location.href
      );

    if (!isExactUsersIndex(url)) {
      return originalFetch(
        request
      );
    }

    return originalFetch(
      request
    ).then(function (response) {
      if (response.ok) {
        captureUsersResponse(
          request,
          response
        );
      }

      return response;
    });
  };

  window.__UBUZIMA_BRANCH_ASSIGNMENT_V3__ = {
    version: VERSION,

    open: openModal,

    assign:
      assignBranchVerified,

    reloadUsers:
      reloadUsers,

    loadBranches:
      loadBranches,

    diagnostics: function () {
      return {
        version: VERSION,
        users_endpoint_captured:
          Boolean(state.usersUrl),
        users_loaded:
          state.users.length,
        branches_loaded:
          state.branches.length,
        button_mounted:
          state.buttonMounted,
        last_verified:
          state.lastVerified,
        last_assigned_user_id:
          state.lastAssignedUserId,
        last_assigned_branch_id:
          state.lastAssignedBranchId,
        inventory_interception:
          false,
        dom_observer:
          false,
        polling_interval:
          false
      };
    }
  };

  console.info(
    '[UbuzimaPlus] Users & Security branch assignment V3 loaded.',
    VERSION
  );
}());

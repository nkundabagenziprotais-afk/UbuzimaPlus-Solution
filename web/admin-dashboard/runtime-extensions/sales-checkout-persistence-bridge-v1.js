(function () {
  'use strict';

  const GLOBAL =
    '__UBUZIMA_SALES_CHECKOUT_PERSISTENCE_BRIDGE_V1__';

  if (window[GLOBAL]) {
    return;
  }

  const nativeFetch =
    typeof window.fetch === 'function'
      ? window.fetch.bind(window)
      : null;

  const xhrPrototype =
    window.XMLHttpRequest
      ? window.XMLHttpRequest.prototype
      : null;

  const nativeXhrOpen =
    xhrPrototype?.open;

  const nativeXhrSend =
    xhrPrototype?.send;

  const identity = {
    customerName: '',
    phoneTin: '',
    insuranceName: '',
  };

  const diagnostics = {
    version: 'v1',
    fetchCheckoutObserved: 0,
    fetchCheckoutModified: 0,
    xhrCheckoutObserved: 0,
    xhrCheckoutModified: 0,
    totalCheckoutObserved: 0,
    totalCheckoutModified: 0,
    lastCustomerName: '',
    lastPhoneTin: '',
    lastInsuranceName: '',
    lastUrl: '',
    lastTransport: '',
    lastResponseStatus: null,
    lastError: '',
  };

  function clean(value) {
    return String(
      value ?? '',
    ).trim();
  }

  function normalized(value) {
    return clean(value)
      .replace(/\s+/g, ' ')
      .replace(/\*/g, '')
      .trim()
      .toLowerCase();
  }

  function controlDescription(control) {
    if (!control) {
      return '';
    }

    const values = [
      control.name,
      control.id,
      control.getAttribute?.(
        'placeholder',
      ),
      control.getAttribute?.(
        'aria-label',
      ),
      control.getAttribute?.(
        'data-label',
      ),
      control.closest?.(
        'label',
      )?.textContent,
    ];

    if (control.labels) {
      for (
        const label
        of control.labels
      ) {
        values.push(
          label.textContent,
        );
      }
    }

    return normalized(
      values
        .filter(Boolean)
        .join(' '),
    );
  }

  function identifyControl(control) {
    const text =
      controlDescription(
        control,
      );

    if (
      text.includes(
        'customer phone/tin',
      )
      || text.includes(
        'customer phone tin',
      )
      || (
        text.includes(
          'phone',
        )
        && text.includes(
          'tin',
        )
      )
    ) {
      return 'phoneTin';
    }

    if (
      text.includes(
        'customer name',
      )
    ) {
      return 'customerName';
    }

    if (
      text.includes(
        'insurance partner',
      )
      || (
        control?.tagName
          === 'SELECT'
        && text.includes(
          'insurance',
        )
        && !text.includes(
          'payment method',
        )
      )
    ) {
      return 'insuranceName';
    }

    return '';
  }

  function insuranceControlValue(
    control,
  ) {
    if (!control) {
      return '';
    }

    if (
      control.tagName
        === 'SELECT'
    ) {
      const option =
        control.selectedOptions?.[0];

      const text =
        clean(
          option?.textContent,
        );

      const lower =
        text.toLowerCase();

      if (
        !text
        || lower.startsWith(
          'select ',
        )
        || lower.startsWith(
          'choose ',
        )
        || lower.startsWith(
          'loading ',
        )
      ) {
        return '';
      }

      return clean(
        text.split('·')[0],
      );
    }

    return clean(
      control.value,
    );
  }

  function controlValue(
    control,
    kind,
  ) {
    if (
      kind
        === 'insuranceName'
    ) {
      return insuranceControlValue(
        control,
      );
    }

    return clean(
      control?.value,
    );
  }

  function remember(control) {
    const kind =
      identifyControl(
        control,
      );

    if (!kind) {
      return;
    }

    identity[kind] =
      controlValue(
        control,
        kind,
      );
  }

  function onControlEvent(event) {
    const target =
      event.target;

    if (
      target
      && target.matches?.(
        'input, select, textarea',
      )
    ) {
      remember(
        target,
      );
    }
  }

  document.addEventListener(
    'input',
    onControlEvent,
    true,
  );

  document.addEventListener(
    'change',
    onControlEvent,
    true,
  );

  function scanControls() {
    for (
      const control
      of document.querySelectorAll(
        'input, select, textarea',
      )
    ) {
      remember(
        control,
      );
    }
  }

  function currentIdentity() {
    scanControls();

    return {
      customerName:
        clean(
          identity.customerName,
        ),

      phoneTin:
        clean(
          identity.phoneTin,
        ),

      insuranceName:
        clean(
          identity.insuranceName,
        ),
    };
  }

  function clearIdentity() {
    identity.customerName = '';
    identity.phoneTin = '';
    identity.insuranceName = '';
  }

  function isCheckoutUrl(value) {
    return clean(
      value,
    ).includes(
      '/pharmaco/sales/checkout',
    );
  }

  function isInsuranceSale(payload) {
    const method =
      clean(
        payload?.payment
          ?.payment_method
        ?? payload
          ?.payment_method
        ?? payload
          ?.paymentMethod,
      ).toLowerCase();

    const type =
      clean(
        payload?.sale_type
        ?? payload?.saleType,
      ).toLowerCase();

    return (
      method
        === 'insurance'
      || type.includes(
        'insurance',
      )
      || Boolean(
        payload
          ?.insurance_partner_id
      )
      || Boolean(
        payload
          ?.insurance_provider_id
      )
    );
  }

  function enrichPayload(payload) {
    const captured =
      currentIdentity();

    const next = {
      ...payload,
    };

    if (
      captured.customerName
    ) {
      next.customer_name =
        captured.customerName;
    }

    if (
      captured.phoneTin
      && /^\d{9}$/.test(
        captured.phoneTin,
      )
    ) {
      next.customer_phone_tin =
        captured.phoneTin;
    }

    if (
      isInsuranceSale(
        next,
      )
      && captured.insuranceName
    ) {
      next.insurance_partner_name =
        captured.insuranceName;
    }

    diagnostics.lastCustomerName =
      clean(
        next.customer_name,
      );

    diagnostics.lastPhoneTin =
      clean(
        next.customer_phone_tin,
      );

    diagnostics.lastInsuranceName =
      clean(
        next.insurance_partner_name,
      );

    return next;
  }

  function parseJsonBody(body) {
    if (
      typeof body
        !== 'string'
      || !body.trim()
    ) {
      return null;
    }

    try {
      const parsed =
        JSON.parse(
          body,
        );

      if (
        !parsed
        || typeof parsed
          !== 'object'
        || Array.isArray(
          parsed,
        )
      ) {
        return null;
      }

      return parsed;
    } catch (_) {
      return null;
    }
  }

  function enrichJsonBody(body) {
    const payload =
      parseJsonBody(
        body,
      );

    if (!payload) {
      return {
        changed: false,
        body,
      };
    }

    const enriched =
      enrichPayload(
        payload,
      );

    const before =
      JSON.stringify(
        payload,
      );

    const after =
      JSON.stringify(
        enriched,
      );

    return {
      changed:
        before !== after,

      body:
        after,
    };
  }

  function fetchUrl(input) {
    if (
      typeof input
        === 'string'
    ) {
      return input;
    }

    if (
      typeof URL
        !== 'undefined'
      && input instanceof URL
    ) {
      return input.href;
    }

    if (
      typeof Request
        !== 'undefined'
      && input instanceof Request
    ) {
      return input.url;
    }

    return clean(
      input?.url,
    );
  }

  function fetchMethod(
    input,
    init,
  ) {
    if (
      init?.method
    ) {
      return clean(
        init.method,
      ).toUpperCase();
    }

    if (
      typeof Request
        !== 'undefined'
      && input instanceof Request
    ) {
      return clean(
        input.method,
      ).toUpperCase();
    }

    return 'GET';
  }

  async function patchedFetch(
    input,
    init,
  ) {
    if (!nativeFetch) {
      throw new Error(
        'Native fetch is unavailable.',
      );
    }

    const url =
      fetchUrl(
        input,
      );

    const method =
      fetchMethod(
        input,
        init,
      );

    if (
      method !== 'POST'
      || !isCheckoutUrl(
        url,
      )
    ) {
      return nativeFetch(
        input,
        init,
      );
    }

    diagnostics.fetchCheckoutObserved += 1;
    diagnostics.totalCheckoutObserved += 1;
    diagnostics.lastUrl = url;
    diagnostics.lastTransport = 'fetch';
    diagnostics.lastError = '';

    try {
      let replacementInput =
        input;

      let replacementInit =
        init;

      let body = null;

      if (
        init
        && typeof init.body
          === 'string'
      ) {
        body =
          init.body;

        const result =
          enrichJsonBody(
            body,
          );

        if (result.changed) {
          diagnostics.fetchCheckoutModified += 1;
          diagnostics.totalCheckoutModified += 1;

          replacementInit = {
            ...init,
            body:
              result.body,
          };
        }
      } else if (
        typeof Request
          !== 'undefined'
        && input instanceof Request
      ) {
        body =
          await input
            .clone()
            .text();

        const result =
          enrichJsonBody(
            body,
          );

        if (result.changed) {
          diagnostics.fetchCheckoutModified += 1;
          diagnostics.totalCheckoutModified += 1;

          replacementInput =
            new Request(
              input,
              {
                body:
                  result.body,
              },
            );
        }
      }

      const response =
        await nativeFetch(
          replacementInput,
          replacementInit,
        );

      diagnostics.lastResponseStatus =
        response?.status
        ?? null;

      if (
        response
        && response.ok
      ) {
        clearIdentity();
      }

      return response;
    } catch (error) {
      diagnostics.lastError =
        clean(
          error?.message
          || error,
        );

      throw error;
    }
  }

  if (nativeFetch) {
    window.fetch =
      patchedFetch;
  }

  if (
    xhrPrototype
    && nativeXhrOpen
    && nativeXhrSend
  ) {
    xhrPrototype.open =
      function patchedOpen(
        method,
        url,
      ) {
        this.__ubuzimaCheckoutBridge = {
          method:
            clean(
              method,
            ).toUpperCase(),

          url:
            clean(
              url,
            ),
        };

        return nativeXhrOpen.apply(
          this,
          arguments,
        );
      };

    xhrPrototype.send =
      function patchedSend(body) {
        const meta =
          this.__ubuzimaCheckoutBridge
          ?? {};

        if (
          meta.method !== 'POST'
          || !isCheckoutUrl(
            meta.url,
          )
        ) {
          return nativeXhrSend.apply(
            this,
            arguments,
          );
        }

        diagnostics.xhrCheckoutObserved += 1;
        diagnostics.totalCheckoutObserved += 1;
        diagnostics.lastUrl =
          meta.url;
        diagnostics.lastTransport =
          'xhr';
        diagnostics.lastError = '';

        let outgoing =
          body;

        try {
          const result =
            enrichJsonBody(
              body,
            );

          if (result.changed) {
            diagnostics.xhrCheckoutModified += 1;
            diagnostics.totalCheckoutModified += 1;

            outgoing =
              result.body;
          }
        } catch (error) {
          diagnostics.lastError =
            clean(
              error?.message
              || error,
            );
        }

        this.addEventListener(
          'loadend',
          function () {
            diagnostics.lastResponseStatus =
              this.status
              ?? null;

            if (
              this.status >= 200
              && this.status < 300
            ) {
              clearIdentity();
            }
          },
          {
            once: true,
          },
        );

        return nativeXhrSend.call(
          this,
          outgoing,
        );
      };
  }

  window[GLOBAL] = {
    version:
      'v1',

    diagnostics() {
      return {
        ...diagnostics,
      };
    },

    currentIdentity() {
      return {
        ...currentIdentity(),
      };
    },

    restoreNativeTransports() {
      if (nativeFetch) {
        window.fetch =
          nativeFetch;
      }

      if (
        xhrPrototype
        && nativeXhrOpen
        && nativeXhrSend
      ) {
        xhrPrototype.open =
          nativeXhrOpen;

        xhrPrototype.send =
          nativeXhrSend;
      }
    },
  };
})();

(function () {
  'use strict';

  const GLOBAL =
    '__UBUZIMA_SALES_CHECKOUT_PERSISTENCE_BRIDGE_V2__';

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

  const nativeOpen =
    xhrPrototype?.open;

  const nativeSend =
    xhrPrototype?.send;

  const memory = {
    customerName: '',
    phoneTin: '',
    insuranceName: '',
  };

  const diagnostics = {
    version: 'v2',
    customerSource: '',
    phoneTinSource: '',
    insuranceSource: '',
    checkoutObserved: 0,
    checkoutModified: 0,
    lastTransport: '',
    lastUrl: '',
    lastCustomerName: '',
    lastPhoneTin: '',
    lastInsuranceName: '',
    lastResponseStatus: null,
    lastError: '',
  };

  function clean(value) {
    return String(
      value ?? '',
    ).trim();
  }

  function norm(value) {
    return clean(value)
      .replace(/\s+/g, ' ')
      .replace(/\*/g, '')
      .trim()
      .toLowerCase();
  }

  function digits(value) {
    return clean(value)
      .replace(/\D+/g, '');
  }

  function explicitPhoneTinControl() {
    const exact =
      document.querySelector(
        'input[aria-describedby~="pos-customer-phone-tin-help"]',
      );

    if (exact) {
      diagnostics.phoneTinSource =
        'aria-describedby';

      return exact;
    }

    const placeholder =
      document.querySelector(
        'input[placeholder="9 digits"][maxlength="9"]',
      );

    if (placeholder) {
      diagnostics.phoneTinSource =
        'placeholder-maxlength';

      return placeholder;
    }

    const pattern =
      document.querySelector(
        'input[pattern="[0-9]{9}"][maxlength="9"]',
      );

    if (pattern) {
      diagnostics.phoneTinSource =
        'pattern-maxlength';

      return pattern;
    }

    return null;
  }

  function exactLabelControl(
    expected,
  ) {
    const target =
      norm(expected);

    for (
      const label
      of document.querySelectorAll(
        'label',
      )
    ) {
      const span =
        label.querySelector(
          ':scope > span',
        );

      const labelText =
        norm(
          span?.textContent
          || label.textContent,
        );

      if (
        labelText !== target
        &&
        !labelText.startsWith(
          target + ' ',
        )
      ) {
        continue;
      }

      const control =
        label.querySelector(
          'input, select, textarea',
        );

      if (control) {
        return control;
      }
    }

    return null;
  }

  function customerControl() {
    const control =
      exactLabelControl(
        'Customer Name',
      );

    diagnostics.customerSource =
      control
        ? 'exact-label'
        : '';

    return control;
  }

  function phoneControl() {
    const exact =
      explicitPhoneTinControl();

    if (exact) {
      return exact;
    }

    const control =
      exactLabelControl(
        'Customer Phone/TIN',
      )
      ||
      exactLabelControl(
        'Phone/TIN',
      );

    diagnostics.phoneTinSource =
      control
        ? 'exact-label'
        : '';

    return control;
  }

  function paymentMethodControl() {
    return (
      exactLabelControl(
        'Payment method',
      )
      ||
      exactLabelControl(
        'Payment Method',
      )
    );
  }

  function insuranceControl() {
    const control =
      exactLabelControl(
        'Insurance partner',
      )
      ||
      exactLabelControl(
        'Insurance Partner',
      )
      ||
      exactLabelControl(
        'Insurance provider',
      )
      ||
      exactLabelControl(
        'Insurance Provider',
      );

    diagnostics.insuranceSource =
      control
        ? 'exact-insurance-label'
        : '';

    return control;
  }

  function selectedText(control) {
    if (!control) {
      return '';
    }

    if (
      control.tagName === 'SELECT'
    ) {
      return clean(
        control
          .selectedOptions?.[0]
          ?.textContent,
      );
    }

    return clean(
      control.value,
    );
  }

  function validInsurance(value) {
    const text =
      clean(value);

    const lower =
      norm(text);

    if (!text) {
      return '';
    }

    const blocked = new Set([
      'walk-in customer',
      'walk in customer',
      'walk-in',
      'walk in',
      'cash',
      'cash sale',
      'select insurance partner',
      'select insurance provider',
      'choose insurance partner',
      'choose insurance provider',
      'no active insurance partners',
      'loading insurance partners…',
      'loading insurance partners...',
      'none',
      'n/a',
    ]);

    if (
      blocked.has(
        lower,
      )
    ) {
      return '';
    }

    return clean(
      text.split('·')[0],
    );
  }

  function isInsuranceSelected() {
    const control =
      paymentMethodControl();

    return (
      norm(
        control?.value,
      )
      === 'insurance'
      ||
      norm(
        selectedText(
          control,
        ),
      )
      === 'insurance'
    );
  }

  function readIdentity() {
    const customer =
      customerControl();

    const phone =
      phoneControl();

    const insurance =
      insuranceControl();

    const customerName =
      clean(
        customer?.value,
      );

    const phoneTin =
      digits(
        phone?.value,
      ).slice(
        0,
        9,
      );

    const insuranceName =
      isInsuranceSelected()
        ? validInsurance(
            selectedText(
              insurance,
            ),
          )
        : '';

    if (customerName) {
      memory.customerName =
        customerName;
    }

    if (
      /^\d{9}$/.test(
        phoneTin,
      )
    ) {
      memory.phoneTin =
        phoneTin;
    } else if (
      phone
      &&
      phoneTin === ''
    ) {
      memory.phoneTin =
        '';
    }

    memory.insuranceName =
      insuranceName;

    return {
      customerName:
        clean(
          customerName
          || memory.customerName,
        ),

      phoneTin:
        /^\d{9}$/.test(
          phoneTin,
        )
          ? phoneTin
          : (
              /^\d{9}$/.test(
                memory.phoneTin,
              )
                ? memory.phoneTin
                : ''
            ),

      insuranceName:
        isInsuranceSelected()
          ? validInsurance(
              insuranceName
              || memory.insuranceName,
            )
          : '',
    };
  }

  function refreshIdentity() {
    readIdentity();
  }

  document.addEventListener(
    'input',
    refreshIdentity,
    true,
  );

  document.addEventListener(
    'change',
    refreshIdentity,
    true,
  );

  document.addEventListener(
    'blur',
    refreshIdentity,
    true,
  );

  function checkoutUrl(url) {
    return clean(
      url,
    ).includes(
      '/pharmaco/sales/checkout',
    );
  }

  function payloadIsInsurance(
    payload,
  ) {
    const method =
      norm(
        payload?.payment
          ?.payment_method
        ??
        payload?.payment_method
        ??
        payload?.paymentMethod
        ??
        '',
      );

    const saleType =
      norm(
        payload?.sale_type
        ??
        payload?.saleType
        ??
        '',
      );

    return (
      method === 'insurance'
      ||
      saleType.includes(
        'insurance',
      )
      ||
      Boolean(
        payload
          ?.insurance_partner_id,
      )
      ||
      Boolean(
        payload
          ?.insurance_provider_id,
      )
    );
  }

  function enrich(payload) {
    const current =
      readIdentity();

    const next = {
      ...payload,
    };

    if (
      current.customerName
    ) {
      next.customer_name =
        current.customerName;
    }

    if (
      /^\d{9}$/.test(
        current.phoneTin,
      )
    ) {
      next.customer_phone_tin =
        current.phoneTin;
    }

    if (
      payloadIsInsurance(
        next,
      )
    ) {
      if (
        current.insuranceName
      ) {
        next.insurance_partner_name =
          current.insuranceName;
      }
    } else {
      delete next.insurance_partner_name;
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
      validInsurance(
        next.insurance_partner_name,
      );

    return next;
  }

  function parseJsonBody(body) {
    if (
      typeof body !== 'string'
      ||
      !body.trim()
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
        ||
        typeof parsed !== 'object'
        ||
        Array.isArray(
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

  function enrichBody(body) {
    const parsed =
      parseJsonBody(
        body,
      );

    if (!parsed) {
      return {
        changed: false,
        body,
      };
    }

    const enriched =
      enrich(
        parsed,
      );

    const before =
      JSON.stringify(
        parsed,
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
      typeof input === 'string'
    ) {
      return input;
    }

    if (
      typeof URL !== 'undefined'
      &&
      input instanceof URL
    ) {
      return input.href;
    }

    if (
      typeof Request !== 'undefined'
      &&
      input instanceof Request
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
      typeof Request !== 'undefined'
      &&
      input instanceof Request
    ) {
      return clean(
        input.method,
      ).toUpperCase();
    }

    return 'GET';
  }

  if (nativeFetch) {
    window.fetch =
      async function (
        input,
        init,
      ) {
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
          ||
          !checkoutUrl(
            url,
          )
        ) {
          return nativeFetch(
            input,
            init,
          );
        }

        diagnostics.checkoutObserved += 1;
        diagnostics.lastTransport =
          'fetch';
        diagnostics.lastUrl =
          url;
        diagnostics.lastError =
          '';

        let outgoingInput =
          input;

        let outgoingInit =
          init;

        try {
          if (
            init
            &&
            typeof init.body === 'string'
          ) {
            const result =
              enrichBody(
                init.body,
              );

            if (result.changed) {
              diagnostics.checkoutModified += 1;

              outgoingInit = {
                ...init,
                body:
                  result.body,
              };
            }
          } else if (
            typeof Request !== 'undefined'
            &&
            input instanceof Request
          ) {
            const body =
              await input
                .clone()
                .text();

            const result =
              enrichBody(
                body,
              );

            if (result.changed) {
              diagnostics.checkoutModified += 1;

              outgoingInput =
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
              outgoingInput,
              outgoingInit,
            );

          diagnostics.lastResponseStatus =
            response?.status
            ?? null;

          return response;
        } catch (error) {
          diagnostics.lastError =
            clean(
              error?.message
              || error,
            );

          throw error;
        }
      };
  }

  if (
    xhrPrototype
    &&
    nativeOpen
    &&
    nativeSend
  ) {
    xhrPrototype.open =
      function (
        method,
        url,
      ) {
        this.__ubuzimaBridgeV2 = {
          method:
            clean(
              method,
            ).toUpperCase(),

          url:
            clean(
              url,
            ),
        };

        return nativeOpen.apply(
          this,
          arguments,
        );
      };

    xhrPrototype.send =
      function (body) {
        const info =
          this.__ubuzimaBridgeV2
          || {};

        if (
          info.method !== 'POST'
          ||
          !checkoutUrl(
            info.url,
          )
        ) {
          return nativeSend.apply(
            this,
            arguments,
          );
        }

        diagnostics.checkoutObserved += 1;
        diagnostics.lastTransport =
          'xhr';
        diagnostics.lastUrl =
          info.url;
        diagnostics.lastError =
          '';

        let outgoing =
          body;

        const result =
          enrichBody(
            body,
          );

        if (result.changed) {
          diagnostics.checkoutModified += 1;

          outgoing =
            result.body;
        }

        this.addEventListener(
          'loadend',
          function () {
            diagnostics.lastResponseStatus =
              this.status
              ?? null;
          },
          {
            once: true,
          },
        );

        return nativeSend.call(
          this,
          outgoing,
        );
      };
  }

  window[GLOBAL] = {
    version: 'v2',

    currentIdentity() {
      return readIdentity();
    },

    diagnostics() {
      return {
        ...diagnostics,
        identity:
          readIdentity(),
      };
    },
  };
})();

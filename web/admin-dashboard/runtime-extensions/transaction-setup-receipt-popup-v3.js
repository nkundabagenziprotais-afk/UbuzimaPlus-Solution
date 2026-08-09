(function () {
  'use strict';

  const GLOBAL =
    '__UBUZIMA_TRANSACTION_RECEIPT_FIX_V3__';

  if (window[GLOBAL]) {
    return;
  }

  const STORAGE =
    'ubuzima_pos_last_transaction_setup_identity_v3';

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

  const state = {
    liveIdentity: {
      customerName: '',
      phoneTin: '',
      insuranceName: '',
    },

    completedIdentity:
      null,

    checkoutObserved:
      0,

    checkoutModified:
      0,

    quantityInputsEnabled:
      0,

    receiptSynchronizations:
      0,

    lastTransport:
      '',

    lastCheckoutStatus:
      null,

    lastSaleId:
      '',

    lastSaleNumber:
      '',

    lastError:
      '',
  };

  function text(value) {
    return String(
      value ?? '',
    ).trim();
  }

  function norm(value) {
    return text(value)
      .replace(/\s+/g, ' ')
      .replace(/\*/g, '')
      .trim()
      .toLowerCase();
  }

  function digits(value) {
    return text(value)
      .replace(/\D+/g, '')
      .slice(0, 9);
  }

  function visible(element) {
    if (
      !element
      ||
      !element.isConnected
    ) {
      return false;
    }

    const style =
      window.getComputedStyle(
        element,
      );

    if (
      style.display === 'none'
      ||
      style.visibility === 'hidden'
    ) {
      return false;
    }

    return (
      element.getClientRects()
        .length > 0
    );
  }

  function controls(root) {
    return Array.from(
      (
        root
        || document
      ).querySelectorAll(
        'input, select, textarea',
      ),
    ).filter(
      visible,
    );
  }

  /*
   * Find the SMALLEST visible container that actually contains
   * the Transaction Set-UP customer identity controls.
   *
   * This prevents hidden/stale duplicate fields elsewhere in
   * the React tree from becoming the source.
   */
  function transactionRoot() {
    const candidates =
      Array.from(
        document.querySelectorAll(
          [
            'fieldset',
            'section',
            'article',
            'form',
            'div',
          ].join(','),
        ),
      )
        .filter(
          visible,
        )
        .filter(
          (node) => {
            const content =
              norm(
                node.textContent,
              );

            return (
              (
                content.includes(
                  'transaction set-up',
                )
                ||
                content.includes(
                  'transaction setup',
                )
              )
              &&
              content.includes(
                'customer name',
              )
              &&
              (
                content.includes(
                  'phone/tin',
                )
                ||
                content.includes(
                  'phone tin',
                )
              )
            );
          },
        );

    if (!candidates.length) {
      return null;
    }

    candidates.sort(
      (a, b) => {
        const aControls =
          controls(a).length;

        const bControls =
          controls(b).length;

        if (
          aControls !== bControls
        ) {
          return (
            aControls
            - bControls
          );
        }

        return (
          a.textContent.length
          - b.textContent.length
        );
      },
    );

    return candidates[0];
  }

  function exactLabelControl(
    root,
    names,
  ) {
    const wanted =
      names.map(
        norm,
      );

    for (
      const label
      of (
        root
        || document
      ).querySelectorAll(
        'label',
      )
    ) {
      if (!visible(label)) {
        continue;
      }

      const directSpan =
        label.querySelector(
          ':scope > span',
        );

      const labelText =
        norm(
          directSpan?.textContent
          || label.textContent,
        );

      if (
        !wanted.some(
          (name) =>
            labelText === name
            ||
            labelText.startsWith(
              name + ' ',
            ),
        )
      ) {
        continue;
      }

      const input =
        label.querySelector(
          'input, select, textarea',
        );

      if (
        input
        && visible(input)
      ) {
        return input;
      }

      const id =
        label.getAttribute(
          'for',
        );

      if (id) {
        const linked =
          document.getElementById(
            id,
          );

        if (
          linked
          && visible(linked)
        ) {
          return linked;
        }
      }
    }

    return null;
  }

  function customerControl(root) {
    return exactLabelControl(
      root,
      [
        'Customer Name',
      ],
    );
  }

  function phoneControl(root) {
    if (root) {
      const explicit =
        Array.from(
          root.querySelectorAll(
            'input[aria-describedby~="pos-customer-phone-tin-help"]',
          ),
        ).find(
          visible,
        );

      if (explicit) {
        return explicit;
      }

      const nineDigits =
        Array.from(
          root.querySelectorAll(
            'input[placeholder="9 digits"][maxlength="9"]',
          ),
        ).find(
          visible,
        );

      if (nineDigits) {
        return nineDigits;
      }

      const pattern =
        Array.from(
          root.querySelectorAll(
            'input[maxlength="9"]',
          ),
        ).find(
          (input) =>
            visible(input)
            &&
            (
              input.getAttribute(
                'pattern',
              )
              === '[0-9]{9}'
              ||
              norm(
                input
                  .closest('label')
                  ?.textContent,
              ).includes(
                'phone/tin',
              )
            ),
        );

      if (pattern) {
        return pattern;
      }
    }

    return exactLabelControl(
      root,
      [
        'Customer Phone/TIN',
        'Phone/TIN',
      ],
    );
  }

  function paymentMethodControl(
    root,
  ) {
    return exactLabelControl(
      root,
      [
        'Payment method',
        'Payment Method',
      ],
    );
  }

  function insuranceControl(
    root,
  ) {
    return exactLabelControl(
      root,
      [
        'Insurance Partner',
        'Insurance partner',
        'Insurance Provider',
        'Insurance provider',
      ],
    );
  }

  function selectedText(control) {
    if (!control) {
      return '';
    }

    if (
      control.tagName === 'SELECT'
    ) {
      return text(
        control
          .selectedOptions?.[0]
          ?.textContent,
      );
    }

    return text(
      control.value,
    );
  }

  function validInsurance(value) {
    const valueText =
      text(value);

    const valueNorm =
      norm(
        valueText,
      );

    if (!valueText) {
      return '';
    }

    const blocked =
      new Set([
        'walk-in customer',
        'walk in customer',
        'walk-in',
        'walk in',
        'cash',
        'cash sale',
        'none',
        'n/a',
        'select insurance',
        'select insurance partner',
        'select insurance provider',
        'choose insurance',
        'choose insurance partner',
        'choose insurance provider',
        'no active insurance partners',
        'loading insurance partners...',
        'loading insurance partners…',
      ]);

    if (
      blocked.has(
        valueNorm,
      )
    ) {
      return '';
    }

    return text(
      valueText.split(
        '·',
      )[0],
    );
  }

  function insuranceSelected(
    root,
  ) {
    const payment =
      paymentMethodControl(
        root,
      );

    const raw =
      norm(
        payment?.value
        || selectedText(
          payment,
        ),
      );

    return (
      raw === 'insurance'
      ||
      raw.includes(
        'insurance',
      )
    );
  }

  /*
   * THIS is now the one Transaction Set-UP read function.
   *
   * Receipt and checkout both call this same function.
   */
  function readTransactionSetup() {
    const root =
      transactionRoot();

    if (!root) {
      return {
        customerName:
          state.liveIdentity
            .customerName,

        phoneTin:
          state.liveIdentity
            .phoneTin,

        insuranceName:
          state.liveIdentity
            .insuranceName,
      };
    }

    const customer =
      customerControl(
        root,
      );

    const phone =
      phoneControl(
        root,
      );

    const insurance =
      insuranceControl(
        root,
      );

    const customerName =
      text(
        customer?.value,
      );

    const phoneTin =
      digits(
        phone?.value,
      );

    const insuranceName =
      insuranceSelected(
        root,
      )
        ? validInsurance(
            selectedText(
              insurance,
            ),
          )
        : '';

    state.liveIdentity = {
      customerName,
      phoneTin:
        /^[0-9]{9}$/.test(
          phoneTin,
        )
          ? phoneTin
          : '',

      insuranceName,
    };

    return {
      ...state.liveIdentity,
    };
  }

  function storeCompletedIdentity(
    identity,
    saleId,
    saleNumber,
  ) {
    const value = {
      customerName:
        text(
          identity.customerName,
        ),

      phoneTin:
        /^[0-9]{9}$/.test(
          digits(
            identity.phoneTin,
          ),
        )
          ? digits(
              identity.phoneTin,
            )
          : '',

      insuranceName:
        validInsurance(
          identity.insuranceName,
        ),

      saleId:
        text(
          saleId,
        ),

      saleNumber:
        text(
          saleNumber,
        ),

      capturedAt:
        Date.now(),
    };

    state.completedIdentity =
      value;

    state.lastSaleId =
      value.saleId;

    state.lastSaleNumber =
      value.saleNumber;

    try {
      sessionStorage.setItem(
        STORAGE,
        JSON.stringify(
          value,
        ),
      );
    } catch (_) {
      // Browser storage is a convenience only.
    }
  }

  function loadCompletedIdentity() {
    if (
      state.completedIdentity
    ) {
      return {
        ...state.completedIdentity,
      };
    }

    try {
      const raw =
        sessionStorage.getItem(
          STORAGE,
        );

      if (!raw) {
        return null;
      }

      const parsed =
        JSON.parse(
          raw,
        );

      if (
        !parsed
        ||
        typeof parsed
          !== 'object'
      ) {
        return null;
      }

      /*
       * Only treat recent same-browser checkout identity as
       * Transaction Set-UP receipt authority.
       *
       * Historical reprints continue to fall back to the
       * existing persisted receipt layer.
       */
      if (
        Date.now()
        - Number(
            parsed.capturedAt
            || 0,
          )
        >
        30 * 60 * 1000
      ) {
        return null;
      }

      state.completedIdentity =
        parsed;

      return {
        ...parsed,
      };
    } catch (_) {
      return null;
    }
  }

  function isCheckout(url) {
    return text(
      url,
    ).includes(
      '/pharmaco/sales/checkout',
    );
  }

  function payloadInsurance(
    payload,
  ) {
    const paymentMethod =
      norm(
        payload?.payment
          ?.payment_method
        ??
        payload
          ?.payment_method
        ??
        payload
          ?.paymentMethod
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
      paymentMethod
        .includes(
          'insurance',
        )
      ||
      saleType
        .includes(
          'insurance',
        )
      ||
      Boolean(
        payload
          ?.insurance_partner_id
      )
      ||
      Boolean(
        payload
          ?.insurance_provider_id
      )
    );
  }

  function enrichCheckoutPayload(
    payload,
  ) {
    const identity =
      readTransactionSetup();

    const next = {
      ...payload,
    };

    next.customer_name =
      identity.customerName
      || null;

    next.customer_phone_tin =
      identity.phoneTin
      || null;

    if (
      payloadInsurance(
        next,
      )
      &&
      identity.insuranceName
    ) {
      next.insurance_partner_name =
        identity.insuranceName;
    } else {
      delete next
        .insurance_partner_name;
    }

    return {
      payload:
        next,

      identity:
        {
          ...identity,
        },
    };
  }

  function parseJson(body) {
    if (
      typeof body !== 'string'
      ||
      !body.trim()
    ) {
      return null;
    }

    try {
      const value =
        JSON.parse(
          body,
        );

      return (
        value
        &&
        typeof value
          === 'object'
        &&
        !Array.isArray(
          value,
        )
      )
        ? value
        : null;
    } catch (_) {
      return null;
    }
  }

  function responseSaleIdentity(
    payload,
  ) {
    const candidates = [
      payload?.sale,
      payload?.data?.sale,
      payload?.transaction,
      payload?.data?.transaction,
      payload?.data,
      payload,
    ];

    for (
      const candidate
      of candidates
    ) {
      if (
        !candidate
        ||
        typeof candidate
          !== 'object'
      ) {
        continue;
      }

      const saleId =
        candidate.id
        ??
        candidate.sale_id
        ??
        candidate.pharmaco_sale_id
        ??
        '';

      const saleNumber =
        candidate.sale_number
        ??
        candidate.saleNumber
        ??
        candidate.reference
        ??
        '';

      if (
        saleId
        ||
        saleNumber
      ) {
        return {
          saleId:
            text(
              saleId,
            ),

          saleNumber:
            text(
              saleNumber,
            ),
        };
      }
    }

    return {
      saleId: '',
      saleNumber: '',
    };
  }

  async function rememberFetchResponse(
    response,
    identity,
  ) {
    if (
      !response
      ||
      !response.ok
    ) {
      return;
    }

    try {
      const payload =
        await response
          .clone()
          .json();

      const sale =
        responseSaleIdentity(
          payload,
        );

      storeCompletedIdentity(
        identity,
        sale.saleId,
        sale.saleNumber,
      );
    } catch (_) {
      storeCompletedIdentity(
        identity,
        '',
        '',
      );
    }
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
      &&
      input instanceof URL
    ) {
      return input.href;
    }

    if (
      typeof Request
        !== 'undefined'
      &&
      input instanceof Request
    ) {
      return input.url;
    }

    return text(
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
      return text(
        init.method,
      ).toUpperCase();
    }

    if (
      typeof Request
        !== 'undefined'
      &&
      input instanceof Request
    ) {
      return text(
        input.method,
      ).toUpperCase();
    }

    return 'GET';
  }

  /*
   * ONE existing checkout request.
   * No secondary request is created.
   */
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
          !isCheckout(
            url,
          )
        ) {
          return nativeFetch(
            input,
            init,
          );
        }

        state.checkoutObserved += 1;
        state.lastTransport =
          'fetch';
        state.lastError =
          '';

        let outgoingInput =
          input;

        let outgoingInit =
          init;

        let checkoutIdentity =
          readTransactionSetup();

        try {
          if (
            init
            &&
            typeof init.body
              === 'string'
          ) {
            const parsed =
              parseJson(
                init.body,
              );

            if (parsed) {
              const result =
                enrichCheckoutPayload(
                  parsed,
                );

              checkoutIdentity =
                result.identity;

              const body =
                JSON.stringify(
                  result.payload,
                );

              if (
                body !== init.body
              ) {
                state.checkoutModified += 1;

                outgoingInit = {
                  ...init,
                  body,
                };
              }
            }
          } else if (
            typeof Request
              !== 'undefined'
            &&
            input instanceof Request
          ) {
            const originalBody =
              await input
                .clone()
                .text();

            const parsed =
              parseJson(
                originalBody,
              );

            if (parsed) {
              const result =
                enrichCheckoutPayload(
                  parsed,
                );

              checkoutIdentity =
                result.identity;

              const body =
                JSON.stringify(
                  result.payload,
                );

              if (
                body !== originalBody
              ) {
                state.checkoutModified += 1;

                outgoingInput =
                  new Request(
                    input,
                    {
                      body,
                    },
                  );
              }
            }
          }

          const response =
            await nativeFetch(
              outgoingInput,
              outgoingInit,
            );

          state.lastCheckoutStatus =
            response?.status
            ?? null;

          await rememberFetchResponse(
            response,
            checkoutIdentity,
          );

          return response;
        } catch (error) {
          state.lastError =
            text(
              error?.message
              || error,
            );

          throw error;
        }
      };
  }

  /*
   * XHR support for the same reason:
   * enrich an existing checkout request only.
   */
  if (
    xhrPrototype
    &&
    nativeXhrOpen
    &&
    nativeXhrSend
  ) {
    xhrPrototype.open =
      function (
        method,
        url,
      ) {
        this.__ubuzimaTransactionV3 = {
          method:
            text(
              method,
            ).toUpperCase(),

          url:
            text(
              url,
            ),
        };

        return nativeXhrOpen.apply(
          this,
          arguments,
        );
      };

    xhrPrototype.send =
      function (body) {
        const request =
          this
            .__ubuzimaTransactionV3
          || {};

        if (
          request.method !== 'POST'
          ||
          !isCheckout(
            request.url,
          )
        ) {
          return nativeXhrSend.apply(
            this,
            arguments,
          );
        }

        state.checkoutObserved += 1;
        state.lastTransport =
          'xhr';
        state.lastError =
          '';

        let outgoing =
          body;

        let checkoutIdentity =
          readTransactionSetup();

        const parsed =
          parseJson(
            body,
          );

        if (parsed) {
          const result =
            enrichCheckoutPayload(
              parsed,
            );

          checkoutIdentity =
            result.identity;

          const replacement =
            JSON.stringify(
              result.payload,
            );

          if (
            replacement !== body
          ) {
            state.checkoutModified += 1;

            outgoing =
              replacement;
          }
        }

        this.addEventListener(
          'loadend',
          function () {
            state.lastCheckoutStatus =
              this.status
              ?? null;

            if (
              this.status >= 200
              &&
              this.status < 300
            ) {
              let saleId =
                '';

              let saleNumber =
                '';

              try {
                const payload =
                  JSON.parse(
                    this.responseText
                    || '{}',
                  );

                const sale =
                  responseSaleIdentity(
                    payload,
                  );

                saleId =
                  sale.saleId;

                saleNumber =
                  sale.saleNumber;
              } catch (_) {
                // Response parsing is optional.
              }

              storeCompletedIdentity(
                checkoutIdentity,
                saleId,
                saleNumber,
              );
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

  /*
   * QUANTITY FIELD
   *
   * Position/layout remains entirely owned by popup V3 CSS.
   * This function ONLY guarantees that the actual quantity
   * control is editable.
   */
  function enableQuantityInput() {
    const dialogs =
      Array.from(
        document.querySelectorAll(
          '.pos-quantity-dialog',
        ),
      ).filter(
        visible,
      );

    for (
      const dialog
      of dialogs
    ) {
      const input =
        Array.from(
          dialog.querySelectorAll(
            '.pos-quantity-input-panel input',
          ),
        ).find(
          visible,
        );

      if (!input) {
        continue;
      }

      let changed =
        false;

      if (
        input.disabled
      ) {
        input.disabled =
          false;

        changed =
          true;
      }

      if (
        input.hasAttribute(
          'disabled',
        )
      ) {
        input.removeAttribute(
          'disabled',
        );

        changed =
          true;
      }

      if (
        input.readOnly
      ) {
        input.readOnly =
          false;

        changed =
          true;
      }

      if (
        input.hasAttribute(
          'readonly',
        )
      ) {
        input.removeAttribute(
          'readonly',
        );

        changed =
          true;
      }

      input.style
        .removeProperty(
          'pointer-events',
        );

      input.style
        .removeProperty(
          'user-select',
        );

      input.setAttribute(
        'data-ubuzima-quantity-editable',
        'true',
      );

      if (changed) {
        state.quantityInputsEnabled += 1;
      }
    }
  }

  function receiptPairs() {
    return Array.from(
      document.querySelectorAll(
        '.receipt-pair',
      ),
    ).filter(
      visible,
    );
  }

  function pairLabel(pair) {
    return norm(
      pair.querySelector(
        'span',
      )?.textContent,
    );
  }

  function pairValueNode(pair) {
    return (
      pair.querySelector(
        'strong',
      )
      ||
      pair.querySelector(
        '[data-value]',
      )
    );
  }

  function receiptPair(
    labels,
  ) {
    const wanted =
      labels.map(
        norm,
      );

    return receiptPairs()
      .find(
        (pair) =>
          wanted.includes(
            pairLabel(
              pair,
            ),
          ),
      )
      || null;
  }

  function receiptContextExists() {
    const customer =
      receiptPair([
        'Customer Name',
      ]);

    const tin =
      receiptPair([
        'Customer TIN',
      ]);

    return Boolean(
      customer
      &&
      tin
    );
  }

  function ensureInsurancePair() {
    let insurance =
      receiptPair([
        'Insurance',
        'Insurance Name',
      ]);

    if (insurance) {
      const label =
        insurance.querySelector(
          'span',
        );

      if (label) {
        label.textContent =
          'Insurance';
      }

      const value =
        pairValueNode(
          insurance,
        );

      if (value) {
        value.setAttribute(
          'data-insurance-name',
          '',
        );
      }

      return insurance;
    }

    const tinPair =
      receiptPair([
        'Customer TIN',
      ]);

    if (!tinPair) {
      return null;
    }

    /*
     * Create a clean row from the existing receipt-pair
     * structure so the new Insurance field inherits the exact
     * receipt typography and spacing.
     */
    insurance =
      tinPair.cloneNode(
        true,
      );

    const label =
      insurance.querySelector(
        'span',
      );

    const value =
      pairValueNode(
        insurance,
      );

    if (!label || !value) {
      return null;
    }

    label.textContent =
      'Insurance';

    value.textContent =
      '—';

    value.removeAttribute(
      'data-customer-tin',
    );

    value.removeAttribute(
      'data-customer-name',
    );

    value.setAttribute(
      'data-insurance-name',
      '',
    );

    tinPair.insertAdjacentElement(
      'afterend',
      insurance,
    );

    return insurance;
  }

  function identityForReceipt() {
    const live =
      readTransactionSetup();

    if (
      live.customerName
      ||
      live.phoneTin
      ||
      live.insuranceName
    ) {
      return {
        ...live,
        source:
          'transaction-setup-live',
      };
    }

    const completed =
      loadCompletedIdentity();

    if (!completed) {
      return null;
    }

    return {
      customerName:
        text(
          completed.customerName,
        ),

      phoneTin:
        /^[0-9]{9}$/.test(
          digits(
            completed.phoneTin,
          ),
        )
          ? digits(
              completed.phoneTin,
            )
          : '',

      insuranceName:
        validInsurance(
          completed.insuranceName,
        ),

      source:
        'transaction-setup-checkout-snapshot',
    };
  }

  /*
   * RECEIPT SOURCE
   *
   * Customer Name
   * Customer TIN
   * Insurance
   *
   * all come from readTransactionSetup() / the checkout
   * snapshot generated by that exact same function.
   *
   * For historical reprints where this browser does not hold
   * a current Transaction Set-UP snapshot, the existing
   * Layer2A6 persisted values remain untouched.
   */
  function syncReceipt() {
    if (
      !receiptContextExists()
    ) {
      return false;
    }

    const identity =
      identityForReceipt();

    const insurancePair =
      ensureInsurancePair();

    if (!identity) {
      /*
       * Historical/reprint fallback:
       * preserve current Layer2A6 Customer Name/TIN values.
       * Insurance row stays available; any persisted
       * data-insurance-name value is preserved.
       */
      return Boolean(
        insurancePair,
      );
    }

    const customerPair =
      receiptPair([
        'Customer Name',
      ]);

    const tinPair =
      receiptPair([
        'Customer TIN',
      ]);

    const customerValue =
      customerPair
        ? pairValueNode(
            customerPair,
          )
        : null;

    const tinValue =
      tinPair
        ? pairValueNode(
            tinPair,
          )
        : null;

    const insuranceValue =
      insurancePair
        ? pairValueNode(
            insurancePair,
          )
        : null;

    if (
      customerValue
      &&
      identity.customerName
    ) {
      customerValue.textContent =
        identity.customerName;

      customerValue.setAttribute(
        'data-customer-name',
        '',
      );

      customerValue.setAttribute(
        'data-transaction-setup-source',
        identity.source,
      );
    }

    if (
      tinValue
      &&
      identity.phoneTin
    ) {
      tinValue.textContent =
        identity.phoneTin;

      tinValue.setAttribute(
        'data-customer-tin',
        '',
      );

      tinValue.setAttribute(
        'data-transaction-setup-source',
        identity.source,
      );
    }

    if (insuranceValue) {
      insuranceValue.textContent =
        identity.insuranceName
          || '—';

      insuranceValue.setAttribute(
        'data-insurance-name',
        '',
      );

      insuranceValue.setAttribute(
        'data-transaction-setup-source',
        identity.source,
      );
    }

    state.receiptSynchronizations += 1;

    return true;
  }

  function refresh() {
    try {
      readTransactionSetup();
      enableQuantityInput();
      syncReceipt();
    } catch (error) {
      state.lastError =
        text(
          error?.message
          || error,
        );
    }
  }

  /*
   * Capture field edits directly.
   */
  document.addEventListener(
    'input',
    refresh,
    true,
  );

  document.addEventListener(
    'change',
    refresh,
    true,
  );

  document.addEventListener(
    'blur',
    refresh,
    true,
  );

  /*
   * Before Download/Print adapters see the click, make sure
   * the receipt DOM already contains the Transaction Set-UP
   * Customer Name, Customer TIN and Insurance values.
   */
  document.addEventListener(
    'click',
    function (event) {
      const target =
        event.target
          ?.closest?.(
            'button, a',
          );

      if (!target) {
        refresh();
        return;
      }

      const content =
        norm(
          target.textContent
          ||
          target.getAttribute(
            'aria-label',
          ),
        );

      if (
        content.includes(
          'download',
        )
        ||
        content.includes(
          'receipt',
        )
        ||
        content.includes(
          'invoice',
        )
        ||
        content.includes(
          'print',
        )
      ) {
        syncReceipt();
      }

      enableQuantityInput();
    },
    true,
  );

  /*
   * Narrow observer:
   * - React can reapply disabled on the popup input.
   * - receipt markup is mounted dynamically.
   *
   * No DOM navigation or global layout changes are performed.
   */
  const observer =
    new MutationObserver(
      function (mutations) {
        let relevant =
          false;

        for (
          const mutation
          of mutations
        ) {
          if (
            mutation.type
              === 'attributes'
          ) {
            const target =
              mutation.target;

            if (
              target
                ?.matches?.(
                  '.pos-quantity-input-panel input',
                )
            ) {
              relevant =
                true;

              break;
            }

            continue;
          }

          if (
            mutation.type
              === 'childList'
            &&
            (
              mutation.addedNodes
                .length
              ||
              mutation.removedNodes
                .length
            )
          ) {
            relevant =
              true;

            break;
          }
        }

        if (relevant) {
          queueMicrotask(
            refresh,
          );
        }
      },
    );

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'disabled',
        'readonly',
      ],
    },
  );

  if (
    document.readyState
      === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      refresh,
      {
        once: true,
      },
    );
  } else {
    refresh();
  }

  window[GLOBAL] = {
    version:
      'v3',

    currentTransactionSetup() {
      return readTransactionSetup();
    },

    lastCompletedTransaction() {
      return loadCompletedIdentity();
    },

    syncReceipt() {
      return syncReceipt();
    },

    enableQuantityInput() {
      enableQuantityInput();

      const input =
        Array.from(
          document.querySelectorAll(
            '.pos-quantity-dialog .pos-quantity-input-panel input',
          ),
        ).find(
          visible,
        );

      return {
        found:
          Boolean(
            input,
          ),

        disabled:
          input
            ? input.disabled
            : null,

        readOnly:
          input
            ? input.readOnly
            : null,

        value:
          input
            ? input.value
            : null,
      };
    },

    diagnostics() {
      return {
        version:
          'v3',

        liveIdentity:
          readTransactionSetup(),

        completedIdentity:
          loadCompletedIdentity(),

        checkoutObserved:
          state.checkoutObserved,

        checkoutModified:
          state.checkoutModified,

        quantityInputsEnabled:
          state.quantityInputsEnabled,

        receiptSynchronizations:
          state.receiptSynchronizations,

        lastTransport:
          state.lastTransport,

        lastCheckoutStatus:
          state.lastCheckoutStatus,

        lastSaleId:
          state.lastSaleId,

        lastSaleNumber:
          state.lastSaleNumber,

        lastError:
          state.lastError,
      };
    },
  };
})();

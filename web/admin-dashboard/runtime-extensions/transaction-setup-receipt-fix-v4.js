(function () {
  'use strict';

  const GLOBAL =
    '__UBUZIMA_TRANSACTION_RECEIPT_FIX_V4__';

  if (window[GLOBAL]) {
    return;
  }

  const STORAGE =
    'ubuzima_pos_completed_transaction_identity_v4';

  const nativeFetch =
    typeof window.fetch === 'function'
      ? window.fetch.bind(window)
      : null;

  const xhrProto =
    window.XMLHttpRequest
      ? window.XMLHttpRequest.prototype
      : null;

  const nativeOpen =
    xhrProto?.open;

  const nativeSend =
    xhrProto?.send;

  const state = {
    live: {
      customerName: '',
      phoneTin: '',
      insuranceName: '',
    },

    completed: null,

    checkoutObserved: 0,
    checkoutModified: 0,

    quantityRepairs: 0,

    receiptSyncAttempts: 0,
    receiptSyncChanges: 0,

    lastTransport: '',
    lastCheckoutStatus: null,

    lastSaleId: '',
    lastSaleNumber: '',

    lastError: '',
  };

  function clean(value) {
    return String(
      value ?? '',
    ).trim();
  }

  function normalize(value) {
    return clean(value)
      .replace(/\s+/g, ' ')
      .replace(/\*/g, '')
      .trim()
      .toLowerCase();
  }

  function digits9(value) {
    return clean(value)
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

    return (
      style.display !== 'none'
      &&
      style.visibility !== 'hidden'
      &&
      element
        .getClientRects()
        .length > 0
    );
  }

  function exactLabelControl(
    root,
    names,
  ) {
    if (!root) {
      return null;
    }

    const wanted =
      names.map(
        normalize,
      );

    for (
      const label
      of root.querySelectorAll(
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
        normalize(
          directSpan?.textContent
          ||
          label.textContent,
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

      const nested =
        label.querySelector(
          'input, select, textarea',
        );

      if (
        nested
        &&
        visible(
          nested,
        )
      ) {
        return nested;
      }

      const forId =
        label.getAttribute(
          'for',
        );

      if (forId) {
        const linked =
          document.getElementById(
            forId,
          );

        if (
          linked
          &&
          visible(
            linked,
          )
        ) {
          return linked;
        }
      }
    }

    return null;
  }

  function explicitPhoneControl() {
    const selectors = [
      'input[aria-describedby~="pos-customer-phone-tin-help"]',
      'input[placeholder="9 digits"][maxlength="9"]',
      'input[maxlength="9"][inputmode="numeric"]',
    ];

    for (
      const selector
      of selectors
    ) {
      const found =
        Array.from(
          document.querySelectorAll(
            selector,
          ),
        ).find(
          visible,
        );

      if (found) {
        return found;
      }
    }

    return null;
  }

  function transactionRoot() {
    const phone =
      explicitPhoneControl();

    if (phone) {
      let node =
        phone.parentElement;

      for (
        let depth = 0;
        node && depth < 8;
        depth += 1,
        node = node.parentElement
      ) {
        if (!visible(node)) {
          continue;
        }

        const content =
          normalize(
            node.textContent,
          );

        if (
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
          &&
          content.includes(
            'payment',
          )
        ) {
          return node;
        }
      }
    }

    const candidates =
      Array.from(
        document.querySelectorAll(
          'fieldset, section, form, article, div',
        ),
      )
        .filter(
          visible,
        )
        .filter(
          (node) => {
            const content =
              normalize(
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
      (a, b) =>
        a.querySelectorAll(
          'input,select,textarea',
        ).length
        -
        b.querySelectorAll(
          'input,select,textarea',
        ).length,
    );

    return candidates[0];
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
    const explicit =
      explicitPhoneControl();

    if (
      explicit
      &&
      (
        !root
        ||
        root.contains(
          explicit,
        )
      )
    ) {
      return explicit;
    }

    return exactLabelControl(
      root,
      [
        'Customer Phone/TIN',
        'Phone/TIN',
      ],
    );
  }

  function paymentControl(root) {
    return exactLabelControl(
      root,
      [
        'Payment method',
        'Payment Method',
      ],
    );
  }

  function insuranceControl(root) {
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
      control.tagName
        === 'SELECT'
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

  function validInsurance(input) {
    const raw =
      clean(
        input,
      );

    const normalizedValue =
      normalize(
        raw,
      );

    if (!raw) {
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
        normalizedValue,
      )
    ) {
      return '';
    }

    return clean(
      raw.split(
        '·',
      )[0],
    );
  }

  function insuranceSelected(root) {
    const control =
      paymentControl(
        root,
      );

    const selected =
      normalize(
        control?.value
        ||
        selectedText(
          control,
        ),
      );

    return (
      selected === 'insurance'
      ||
      selected.includes(
        'insurance',
      )
    );
  }

  function readTransactionSetup() {
    const root =
      transactionRoot();

    if (!root) {
      return {
        ...state.live,
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
      clean(
        customer?.value,
      );

    const phoneDigits =
      digits9(
        phone?.value,
      );

    state.live = {
      customerName,

      phoneTin:
        /^[0-9]{9}$/.test(
          phoneDigits,
        )
          ? phoneDigits
          : '',

      insuranceName:
        insuranceSelected(
          root,
        )
          ? validInsurance(
              selectedText(
                insurance,
              ),
            )
          : '',
    };

    return {
      ...state.live,
    };
  }

  function saveCompleted(
    identity,
    saleId = '',
    saleNumber = '',
  ) {
    const phoneTin =
      digits9(
        identity?.phoneTin,
      );

    const record = {
      customerName:
        clean(
          identity
            ?.customerName,
        ),

      phoneTin:
        /^[0-9]{9}$/.test(
          phoneTin,
        )
          ? phoneTin
          : '',

      insuranceName:
        validInsurance(
          identity
            ?.insuranceName,
        ),

      saleId:
        clean(
          saleId,
        ),

      saleNumber:
        clean(
          saleNumber,
        ),

      capturedAt:
        Date.now(),
    };

    state.completed =
      record;

    state.lastSaleId =
      record.saleId;

    state.lastSaleNumber =
      record.saleNumber;

    try {
      sessionStorage.setItem(
        STORAGE,
        JSON.stringify(
          record,
        ),
      );
    } catch (_) {
      // Optional browser storage.
    }
  }

  function loadCompleted() {
    if (
      state.completed
    ) {
      return {
        ...state.completed,
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

      if (
        Date.now()
        -
        Number(
          parsed.capturedAt
          || 0,
        )
        >
        30 * 60 * 1000
      ) {
        return null;
      }

      state.completed =
        parsed;

      return {
        ...parsed,
      };
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
      const item
      of candidates
    ) {
      if (
        !item
        ||
        typeof item
          !== 'object'
      ) {
        continue;
      }

      const saleId =
        item.id
        ??
        item.sale_id
        ??
        item.pharmaco_sale_id
        ??
        '';

      const saleNumber =
        item.sale_number
        ??
        item.saleNumber
        ??
        item.reference
        ??
        '';

      if (
        saleId
        ||
        saleNumber
      ) {
        return {
          saleId:
            clean(
              saleId,
            ),

          saleNumber:
            clean(
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

  function isCheckoutUrl(url) {
    return clean(
      url,
    ).includes(
      '/pharmaco/sales/checkout',
    );
  }

  function payloadIsInsurance(
    payload,
  ) {
    const payment =
      normalize(
        payload
          ?.payment
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
      normalize(
        payload
          ?.sale_type
        ??
        payload
          ?.saleType
        ??
        '',
      );

    return (
      payment.includes(
        'insurance',
      )
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

  function enrichCheckoutPayload(
    payload,
  ) {
    const identity =
      readTransactionSetup();

    const next = {
      ...payload,
    };

    if (
      identity.customerName
    ) {
      next.customer_name =
        identity.customerName;
    } else {
      delete next.customer_name;
    }

    if (
      /^[0-9]{9}$/.test(
        identity.phoneTin,
      )
    ) {
      next.customer_phone_tin =
        identity.phoneTin;
    } else {
      delete next.customer_phone_tin;
    }

    if (
      payloadIsInsurance(
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

      identity: {
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
      const parsed =
        JSON.parse(
          body,
        );

      if (
        !parsed
        ||
        typeof parsed
          !== 'object'
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
          !isCheckoutUrl(
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

        let identity =
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

              identity =
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
            const original =
              await input
                .clone()
                .text();

            const parsed =
              parseJson(
                original,
              );

            if (parsed) {
              const result =
                enrichCheckoutPayload(
                  parsed,
                );

              identity =
                result.identity;

              const body =
                JSON.stringify(
                  result.payload,
                );

              if (
                body !== original
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

          if (
            response
            &&
            response.ok
          ) {
            try {
              const responsePayload =
                await response
                  .clone()
                  .json();

              const sale =
                responseSaleIdentity(
                  responsePayload,
                );

              saveCompleted(
                identity,
                sale.saleId,
                sale.saleNumber,
              );
            } catch (_) {
              saveCompleted(
                identity,
              );
            }

            scheduleReceiptSync();
          }

          return response;
        } catch (error) {
          state.lastError =
            clean(
              error?.message
              ||
              error,
            );

          throw error;
        }
      };
  }

  if (
    xhrProto
    &&
    nativeOpen
    &&
    nativeSend
  ) {
    xhrProto.open =
      function (
        method,
        url,
      ) {
        this.__ubuzimaV4Request = {
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

    xhrProto.send =
      function (body) {
        const request =
          this
            .__ubuzimaV4Request
          || {};

        if (
          request.method !== 'POST'
          ||
          !isCheckoutUrl(
            request.url,
          )
        ) {
          return nativeSend.apply(
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

        let identity =
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

          identity =
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
                const responsePayload =
                  JSON.parse(
                    this.responseText
                    || '{}',
                  );

                const sale =
                  responseSaleIdentity(
                    responsePayload,
                  );

                saleId =
                  sale.saleId;

                saleNumber =
                  sale.saleNumber;
              } catch (_) {
                // Response metadata optional.
              }

              saveCompleted(
                identity,
                saleId,
                saleNumber,
              );

              scheduleReceiptSync();
            }
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

  function quantityInput() {
    const dialog =
      Array.from(
        document.querySelectorAll(
          '.pos-quantity-dialog',
        ),
      ).find(
        visible,
      );

    if (!dialog) {
      return null;
    }

    return (
      Array.from(
        dialog.querySelectorAll(
          '.pos-quantity-selling-unit-hero > label > input',
        ),
      ).find(
        visible,
      )
      ||
      null
    );
  }

  function ensureQuantityEditable() {
    const input =
      quantityInput();

    if (!input) {
      return {
        found: false,
        visible: false,
        disabled: null,
        readOnly: null,
        value: null,
      };
    }

    let repaired =
      false;

    if (
      input.disabled
    ) {
      input.disabled =
        false;

      repaired =
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

      repaired =
        true;
    }

    if (
      input.readOnly
    ) {
      input.readOnly =
        false;

      repaired =
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

      repaired =
        true;
    }

    if (repaired) {
      state.quantityRepairs += 1;
    }

    return {
      found: true,

      visible:
        visible(
          input,
        ),

      disabled:
        input.disabled,

      readOnly:
        input.readOnly,

      value:
        input.value,
    };
  }

  function scheduleQuantityRepair() {
    for (
      const delay
      of [
        0,
        40,
        100,
        220,
        400,
      ]
    ) {
      window.setTimeout(
        ensureQuantityEditable,
        delay,
      );
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
    return normalize(
      pair
        ?.querySelector(
          'span',
        )
        ?.textContent,
    );
  }

  function pairValue(pair) {
    return (
      pair
        ?.querySelector(
          'strong',
        )
      ||
      pair
        ?.querySelector(
          '[data-value]',
        )
      ||
      null
    );
  }

  function findPair(labels) {
    const wanted =
      labels.map(
        normalize,
      );

    return (
      receiptPairs()
        .find(
          (pair) =>
            wanted.includes(
              pairLabel(
                pair,
              ),
            ),
        )
      ||
      null
    );
  }

  function setText(
    node,
    nextValue,
  ) {
    if (!node) {
      return false;
    }

    const next =
      clean(
        nextValue,
      );

    if (
      clean(
        node.textContent,
      )
      === next
    ) {
      return false;
    }

    node.textContent =
      next;

    return true;
  }

  function ensureInsuranceRow() {
    let pair =
      findPair([
        'Insurance',
        'Insurance Name',
      ]);

    if (pair) {
      const label =
        pair.querySelector(
          'span',
        );

      const valueNode =
        pairValue(
          pair,
        );

      setText(
        label,
        'Insurance',
      );

      if (valueNode) {
        valueNode.removeAttribute(
          'data-customer-name',
        );

        valueNode.removeAttribute(
          'data-customer-tin',
        );

        valueNode.setAttribute(
          'data-insurance-name',
          '',
        );
      }

      return pair;
    }

    const tinPair =
      findPair([
        'Customer TIN',
      ]);

    if (!tinPair) {
      return null;
    }

    pair =
      tinPair.cloneNode(
        true,
      );

    const label =
      pair.querySelector(
        'span',
      );

    const valueNode =
      pairValue(
        pair,
      );

    if (
      !label
      ||
      !valueNode
    ) {
      return null;
    }

    label.textContent =
      'Insurance';

    valueNode.textContent =
      '—';

    valueNode.removeAttribute(
      'data-customer-name',
    );

    valueNode.removeAttribute(
      'data-customer-tin',
    );

    valueNode.setAttribute(
      'data-insurance-name',
      '',
    );

    tinPair.insertAdjacentElement(
      'afterend',
      pair,
    );

    return pair;
  }

  function syncReceipt() {
    state.receiptSyncAttempts += 1;

    const customerPair =
      findPair([
        'Customer Name',
      ]);

    const tinPair =
      findPair([
        'Customer TIN',
      ]);

    if (
      !customerPair
      ||
      !tinPair
    ) {
      return {
        found: false,
        changed: false,
      };
    }

    const identity =
      loadCompleted();

    const insurancePair =
      ensureInsuranceRow();

    if (!identity) {
      return {
        found: true,
        changed: false,
        source:
          'persisted-layer-fallback',
      };
    }

    let changed =
      false;

    const customerValue =
      pairValue(
        customerPair,
      );

    const tinValue =
      pairValue(
        tinPair,
      );

    const insuranceValue =
      pairValue(
        insurancePair,
      );

    if (
      customerValue
      &&
      identity.customerName
    ) {
      changed =
        setText(
          customerValue,
          identity.customerName,
        )
        ||
        changed;

      customerValue.setAttribute(
        'data-customer-name',
        '',
      );
    }

    if (
      tinValue
      &&
      identity.phoneTin
    ) {
      changed =
        setText(
          tinValue,
          identity.phoneTin,
        )
        ||
        changed;

      tinValue.setAttribute(
        'data-customer-tin',
        '',
      );
    }

    if (insuranceValue) {
      changed =
        setText(
          insuranceValue,
          identity.insuranceName
            || '—',
        )
        ||
        changed;

      insuranceValue.setAttribute(
        'data-insurance-name',
        '',
      );
    }

    if (changed) {
      state.receiptSyncChanges += 1;
    }

    return {
      found: true,
      changed,

      source:
        'transaction-setup-checkout-snapshot',

      identity: {
        ...identity,
      },
    };
  }

  let receiptToken =
    0;

  function scheduleReceiptSync() {
    receiptToken += 1;

    const token =
      receiptToken;

    for (
      const delay
      of [
        0,
        70,
        160,
        320,
        600,
        1000,
      ]
    ) {
      window.setTimeout(
        function () {
          if (
            token
            !== receiptToken
          ) {
            return;
          }

          syncReceipt();
        },
        delay,
      );
    }
  }

  function isReceiptAction(target) {
    const control =
      target
        ?.closest?.(
          'button, a',
        );

    if (!control) {
      return false;
    }

    if (
      control.matches(
        [
          '[data-receipt-download]',
          '[data-receipt-action]',
          '[data-receipt-hard-copy]',
          '[data-receipt-whatsapp]',
          '[data-receipt-email]',
        ].join(','),
      )
    ) {
      return true;
    }

    const label =
      normalize(
        control.textContent
        ||
        control.getAttribute(
          'aria-label',
        ),
      );

    return (
      label.includes(
        'receipt',
      )
      ||
      label.includes(
        'invoice',
      )
      ||
      label.includes(
        'download',
      )
    );
  }

  document.addEventListener(
    'input',
    function () {
      readTransactionSetup();
    },
    true,
  );

  document.addEventListener(
    'change',
    function () {
      readTransactionSetup();
    },
    true,
  );

  document.addEventListener(
    'click',
    function (event) {
      scheduleQuantityRepair();

      if (
        isReceiptAction(
          event.target,
        )
      ) {
        syncReceipt();
        scheduleReceiptSync();
      }
    },
    true,
  );

  window[GLOBAL] = {
    version:
      'v4',

    currentTransactionSetup() {
      return readTransactionSetup();
    },

    lastCompletedTransaction() {
      return loadCompleted();
    },

    quantityField() {
      return ensureQuantityEditable();
    },

    syncReceipt() {
      return syncReceipt();
    },

    diagnostics() {
      return {
        version:
          'v4',

        transaction:
          readTransactionSetup(),

        completed:
          loadCompleted(),

        checkoutObserved:
          state.checkoutObserved,

        checkoutModified:
          state.checkoutModified,

        quantityRepairs:
          state.quantityRepairs,

        receiptSyncAttempts:
          state.receiptSyncAttempts,

        receiptSyncChanges:
          state.receiptSyncChanges,

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

  readTransactionSetup();

  scheduleQuantityRepair();
})();

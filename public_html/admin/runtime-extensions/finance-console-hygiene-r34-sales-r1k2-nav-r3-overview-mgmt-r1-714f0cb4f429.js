

;(()=>{
  if(window.__AQUILA_FINANCE_NATIVE_DATA_R1__)return;

  const aqFinanceNativeSnapshots=new Map();

  const api=Object.freeze({
    get(key){
      return aqFinanceNativeSnapshots.get(key);
    },

    publish(key,value){
      aqFinanceNativeSnapshots.set(key,value);

      window.dispatchEvent(
        new CustomEvent(
          "aquila:finance-native-data",
          {detail:{key}}
        )
      );
    },

    diagnose(){
      return Object.freeze({
        keys:Array.from(aqFinanceNativeSnapshots.keys()),
        size:aqFinanceNativeSnapshots.size
      });
    }
  });

  Object.defineProperty(
    window,
    "__AQUILA_FINANCE_NATIVE_DATA_R1__",
    {
      value:api,
      configurable:false,
      enumerable:false,
      writable:false
    }
  );
})();

(function(){
'use strict';

if(
  window.__AQUILA_FINANCE_DATA_COORDINATOR__ &&
  window.__AQUILA_FINANCE_DATA_COORDINATOR__.version === 'R2.9.4'
) return;

var V='R2.9.4';
var TTL=60000;
var RETRY=180;
var MAX=5242880;

var native=
  typeof window.fetch === 'function'
    ? window.fetch.bind(window)
    : null;

var cache=new Map();
var inflight=new Map();
var mods={};

var stats={
  requestsSeen:0,
  financeRequests:0,
  networkRequests:0,
  cacheHits:0,
  cacheWrites:0,
  deduplicated:0,
  retries:0,
  staleFallbacks:0,
  invalidations:0,
  errors:0,
  lastUrl:'',
  lastModule:'',
  lastStatus:null,
  lastError:null,
  lastSuccessAt:null
};

function mod(){
  try{
    var p=
      new URLSearchParams(
        String(
          location.hash || ''
        ).replace(
          /^#/,
          ''
        )
      );

    return (
      p.get('finance') ||
      (
        p.get('section') === 'finance'
          ? 'overview'
          : ''
      )
    );
  }catch(_){
    return '';
  }
}

function bucket(m){
  m=m || 'unknown';

  return (
    mods[m] ||
    (
      mods[m]={
        seen:0,
        network:0,
        cacheHits:0,
        deduplicated:0,
        retries:0,
        staleFallbacks:0,
        successes:0,
        errors:0,
        lastUrl:'',
        lastStatus:null,
        lastError:null,
        lastSuccessAt:null
      }
    )
  );
}

function urlOf(i){
  try{
    return new URL(
      typeof i === 'string'
        ? i
        : (
          i && i.url
        ) || '',
      location.href
    );
  }catch(_){
    return null;
  }
}

function methodOf(i,o){
  return String(
    (o && o.method) ||
    (i && i.method) ||
    'GET'
  ).toUpperCase();
}

function api(u){
  if(!u) return false;

  var host=
    u.origin === location.origin ||
    /\.ubuzimaplus\.com$/i.test(
      u.hostname
    );

  var p=
    String(
      u.pathname || ''
    );

  if(
    !host ||
    /\.(js|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|map|pdf)$/i
      .test(p)
  ){
    return false;
  }

  if(
    /\/(login|logout|auth|csrf|token|session|password|permissions?|roles?|users?\/me|me)(\/|$)/i
      .test(p)
  ){
    return false;
  }

  return (
    /\/(api|backend|backend-api)(\/|$)/i
      .test(p) ||
    /finance|financial|ledger|journal|receivable|payable|cash[-_ ]?flow|sales/i
      .test(p)
  );
}

function force(i,o){
  var c=
    String(
      (o && o.cache) ||
      (i && i.cache) ||
      ''
    ).toLowerCase();

  return (
    c === 'reload' ||
    c === 'no-cache' ||
    c === 'no-store'
  );
}

function key(i,o,u){
  var a='';

  try{
    a=
      new Headers(
        (o && o.headers) ||
        (i && i.headers) ||
        undefined
      ).get('accept') ||
      '';
  }catch(_){}

  return [
    mod(),
    u.href,
    a
  ].join('|');
}

function responseOf(s,src){
  var body=
    (
      s.status === 204 ||
      s.status === 205 ||
      s.status === 304
    )
      ? null
      : s.body.slice(0);

  var r=
    new Response(
      body,
      {
        status:s.status,
        statusText:s.statusText,
        headers:s.headers
      }
    );

  try{
    Object.defineProperty(
      r,
      'url',
      {
        configurable:true,
        value:s.url
      }
    );

    Object.defineProperty(
      r,
      '__aquilaFinanceCache',
      {
        configurable:true,
        value:src
      }
    );
  }catch(_){}

  return r;
}

function snap(r){
  return r
    .arrayBuffer()
    .then(
      function(b){

        var h=[];

        r.headers.forEach(
          function(v,n){
            h.push([n,v]);
          }
        );

        return {
          body:b,
          headers:h,
          status:r.status,
          statusText:r.statusText,
          url:r.url || '',
          ok:r.ok,
          noStore:
            /\bno-store\b/i.test(
              r.headers.get(
                'cache-control'
              ) || ''
            ),
          small:
            b.byteLength <= MAX,
          at:
            Date.now()
        };
      }
    );
}

function sleep(ms){
  return new Promise(
    function(resolve){
      setTimeout(
        resolve,
        ms
      );
    }
  );
}

function net(i,o,attempt,m){

  stats.networkRequests++;

  var b=
    bucket(m);

  b.network++;

  return native(i,o)
    .then(snap)
    .then(
      function(s){

        stats.lastStatus=
          s.status;

        if(
          s.status >= 500 &&
          attempt === 0
        ){
          stats.retries++;
          b.retries++;

          return sleep(RETRY)
            .then(
              function(){
                return net(
                  i,
                  o,
                  1,
                  m
                );
              }
            );
        }

        return s;
      }
    )
    .catch(
      function(e){

        if(attempt === 0){
          stats.retries++;
          b.retries++;

          return sleep(RETRY)
            .then(
              function(){
                return net(
                  i,
                  o,
                  1,
                  m
                );
              }
            );
        }

        throw e;
      }
    );
}

function invalidate(reason){
  cache.clear();

  stats.invalidations++;

  stats.lastInvalidationReason=
    reason ||
    'manual';
}

function get(i,o,u){

  var m=mod();
  var b=bucket(m);
  var k=key(i,o,u);
  var old=cache.get(k);

  if(
    old &&
    !force(i,o) &&
    Date.now() - old.at < TTL
  ){
    stats.cacheHits++;
    b.cacheHits++;
    b.successes++;

    b.lastStatus=
      old.s.status;

    b.lastSuccessAt=
      new Date()
        .toISOString();

    return Promise.resolve(
      responseOf(
        old.s,
        'memory-hit'
      )
    );
  }

  if(
    inflight.has(k)
  ){
    stats.deduplicated++;
    b.deduplicated++;

    return inflight
      .get(k)
      .then(
        function(s){
          return responseOf(
            s,
            'deduplicated'
          );
        }
      );
  }

  var p=
    net(
      i,
      o,
      0,
      m
    )
    .then(
      function(s){

        if(
          s.ok &&
          s.small &&
          !s.noStore
        ){
          cache.set(
            k,
            {
              at:Date.now(),
              s:s
            }
          );

          stats.cacheWrites++;
        }

        if(s.ok){

          var t=
            new Date()
              .toISOString();

          stats.lastSuccessAt=t;
          stats.lastError=null;

          b.successes++;
          b.lastStatus=s.status;
          b.lastSuccessAt=t;
          b.lastError=null;
        }

        return s;
      }
    )
    .catch(
      function(e){

        var msg=
          e && e.message
            ? e.message
            : String(e);

        if(old){

          stats.staleFallbacks++;
          b.staleFallbacks++;

          stats.lastError=msg;
          b.lastError=msg;

          return old.s;
        }

        stats.errors++;
        b.errors++;

        stats.lastError=msg;
        b.lastError=msg;

        throw e;
      }
    )
    .finally(
      function(){
        inflight.delete(k);
      }
    );

  inflight.set(
    k,
    p
  );

  return p.then(
    function(s){
      return responseOf(
        s,
        old
          ? 'network-or-stale'
          : 'network'
      );
    }
  );
}

function wrapped(i,o){

  stats.requestsSeen++;

  if(!native){
    return Promise.reject(
      new Error(
        'FETCH_NOT_AVAILABLE'
      )
    );
  }

  var u=urlOf(i);
  var m=methodOf(i,o);

  if(
    !mod() ||
    !api(u)
  ){
    return native(i,o);
  }

  stats.financeRequests++;

  var b=
    bucket(
      mod()
    );

  b.seen++;

  b.lastUrl=
    u
      ? u.href
      : '';

  stats.lastUrl=
    u
      ? u.href
      : '';

  stats.lastModule=
    mod();

  if(m === 'GET'){
    return get(
      i,
      o,
      u
    );
  }

  return native(i,o)
    .then(
      function(r){

        if(
          r &&
          r.ok
        ){
          invalidate(
            'finance-mutation:' +
            m
          );
        }

        return r;
      }
    );
}

var API={
  version:V,
  ttlMs:TTL,
  memoryOnly:true,
  persistentStorage:false,
  nativeFetchAvailable:
    !!native,
  invalidate:
    invalidate,
  diagnose:
    function(){

      var entries=[];

      cache.forEach(
        function(v,k){
          entries.push({
            key:k,
            ageMs:
              Date.now() -
              v.at,
            status:
              v.s.status
          });
        }
      );

      return {
        version:V,
        module:mod(),
        financeRoute:
          !!mod(),
        ttlMs:TTL,
        memoryOnly:true,
        persistentStorage:false,
        cacheEntries:
          entries,
        inflightCount:
          inflight.size,
        stats:
          Object.assign(
            {},
            stats
          ),
        modules:
          JSON.parse(
            JSON.stringify(
              mods
            )
          )
      };
    }
};

window
  .__AQUILA_FINANCE_DATA_COORDINATOR__ =
  API;

if(native){
  wrapped
    .__aquilaFinanceR294 =
    true;

  wrapped
    .__aquilaNativeFetch =
    native;

  window.fetch=
    wrapped;
}

})();
(function () {
  'use strict';

  if (
    window.__AQUILA_FINANCE_CACHE_OVERVIEW_R1_2_R2_INSTALLED__
  ) {
    return;
  }

  const RELEASE =
    'AQUILA_FINANCE_CACHE_OVERVIEW_R1_2_R2';

  const STORAGE_KEY =
    'aquila.finance.cache.r1.2.r2';

  const CACHE_FRESH_MS =
    30 * 1000;

  const CACHE_STALE_MS =
    5 * 60 * 1000;

  const DEFAULT_TABLE_ROWS =
    5;

  const RETRY_DELAYS = [
    0,
    100,
    250,
    500,
    900,
    1500,
    2500,
    4000,
    6500,
    9000,
  ];

  const FINANCE_PREFIX =
    '/api/v1/pharmaco/finance/commercial/';

  const TRIAL_BALANCE_URL =
    '/api/v1/pharmaco/accounting/trial-balance';

  const PURCHASE_ORDER_URL =
    '/api/v1/pharmaco/purchase-orders';

  const originalFetch =
    window.fetch.bind(window);

  const inflight =
    new Map();

  const revalidating =
    new Map();

  const diagnostics = {
    release:
      RELEASE,

    cache_hits:
      0,

    stale_hits:
      0,

    network_fetches:
      0,

    revalidations:
      0,

    cards_bound:
      0,

    trend_labels_rendered:
      0,

    table_rows: {
      recent_transactions:
        0,

      top_receivables:
        0,

      upcoming_payables:
        0,

      bank_accounts:
        0,
    },

    last_sources:
      {},

    last_error:
      null,

    last_apply_at:
      null,
  };

  function safeJson(value) {
    try {
      return value
        ? JSON.parse(value)
        : null;
    } catch (_error) {
      return null;
    }
  }

  function text(value) {
    return String(
      value ?? '',
    )
      .replace(
        /&/g,
        'and',
      )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim()
      .toLowerCase();
  }

  function number(value) {
    if (
      typeof value
      === 'number'
    ) {
      return Number.isFinite(
        value,
      )
        ? value
        : null;
    }

    if (
      value === null
      || value === undefined
    ) {
      return null;
    }

    const cleaned =
      String(value)
        .replace(
          /[^0-9.+-]/g,
          '',
        );

    if (
      !cleaned
      || cleaned === '-'
      || cleaned === '.'
    ) {
      return null;
    }

    const parsed =
      Number(cleaned);

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  }

  function money(value) {
    const parsed =
      number(value);

    if (
      parsed === null
    ) {
      return '—';
    }

    return (
      'RWF '
      + new Intl.NumberFormat(
        'en-RW',
        {
          minimumFractionDigits:
            2,

          maximumFractionDigits:
            2,
        },
      ).format(
        parsed,
      )
    );
  }

  function percent(value) {
    const parsed =
      number(value);

    if (
      parsed === null
    ) {
      return '—';
    }

    return (
      new Intl.NumberFormat(
        'en-RW',
        {
          minimumFractionDigits:
            1,

          maximumFractionDigits:
            1,
        },
      ).format(
        parsed,
      )
      + '%'
    );
  }

  function compact(value) {
    const parsed =
      number(value);

    if (
      parsed === null
    ) {
      return '—';
    }

    const abs =
      Math.abs(parsed);

    if (
      abs >= 1000000000
    ) {
      return (
        (
          parsed
          / 1000000000
        ).toFixed(1)
          .replace(
            /\.0$/,
            '',
          )
        + 'B'
      );
    }

    if (
      abs >= 1000000
    ) {
      return (
        (
          parsed
          / 1000000
        ).toFixed(1)
          .replace(
            /\.0$/,
            '',
          )
        + 'M'
      );
    }

    if (
      abs >= 1000
    ) {
      return (
        (
          parsed
          / 1000
        ).toFixed(1)
          .replace(
            /\.0$/,
            '',
          )
        + 'K'
      );
    }

    return Math.round(
      parsed,
    ).toLocaleString(
      'en-RW',
    );
  }

  function firstString(values) {
    for (
      const value
      of values
    ) {
      if (
        typeof value
        === 'string'
        && value.trim()
      ) {
        return value.trim();
      }
    }

    return '';
  }

  function sessionContext() {
    const record =
      safeJson(
        localStorage.getItem(
          'ubuzima_admin_session',
        ),
      )
      ?? safeJson(
        sessionStorage.getItem(
          'ubuzima_admin_session',
        ),
      )
      ?? {};

    const profile =
      (
        record.profile
        && typeof record.profile
        === 'object'
      )
        ? record.profile
        : (
          record.user
          && typeof record.user
          === 'object'
        )
          ? record.user
          : {};

    const assignments =
      Array.isArray(
        profile.tenant_assignments,
      )
        ? profile.tenant_assignments
        : Array.isArray(
          profile.tenantAssignments,
        )
          ? profile.tenantAssignments
          : [];

    const active =
      assignments.find(
        (assignment) =>
          text(
            assignment?.status
            ?? 'active',
          )
          === 'active',
      )
      ?? assignments[0]
      ?? null;

    const tenantSlug =
      firstString([
        active?.tenant?.slug,
        active?.tenant_slug,
        profile?.tenant?.slug,
        profile?.tenant_slug,
      ]);

    const token =
      firstString([
        record.token,
        record.access_token,
        record.accessToken,
      ]);

    const userId =
      profile.id
      ?? profile.user_id
      ?? record.user_id
      ?? '';

    return {
      token,
      tenantSlug,
      userId:
        String(userId),
    };
  }

  function tokenHash(value) {
    let hash =
      2166136261;

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^=
        value.charCodeAt(
          index,
        );

      hash =
        Math.imul(
          hash,
          16777619,
        );
    }

    return (
      hash >>> 0
    ).toString(16);
  }

  function urlOf(input) {
    try {
      return new URL(
        input instanceof Request
          ? input.url
          : String(input),

        window.location.origin,
      );
    } catch (_error) {
      return null;
    }
  }

  function methodOf(
    input,
    init,
  ) {
    return String(
      init?.method
      ?? (
        input instanceof Request
          ? input.method
          : 'GET'
      ),
    ).toUpperCase();
  }

  function cacheable(
    input,
    init,
  ) {
    if (
      methodOf(
        input,
        init,
      )
      !== 'GET'
    ) {
      return false;
    }

    const url =
      urlOf(input);

    if (
      !url
      || url.origin
      !== window.location.origin
    ) {
      return false;
    }

    return (
      url.pathname.startsWith(
        FINANCE_PREFIX,
      )
      || url.pathname
        === TRIAL_BALANCE_URL
      || url.pathname
        === PURCHASE_ORDER_URL
    );
  }

  function cacheKey(
    input,
  ) {
    const url =
      urlOf(input);

    const context =
      sessionContext();

    return [
      RELEASE,

      context.userId
        || (
          context.token
            ? tokenHash(
              context.token,
            )
            : 'anonymous'
        ),

      context.tenantSlug,

      url?.pathname
        ?? String(input),

      url?.search
        ?? '',
    ].join('|');
  }

  function storeRead() {
    return (
      safeJson(
        sessionStorage.getItem(
          STORAGE_KEY,
        ),
      )
      ?? {}
    );
  }

  function storeWrite(store) {
    try {
      const trimmed =
        Object.fromEntries(
          Object.entries(
            store,
          )
            .sort(
              (
                left,
                right,
              ) =>
                Number(
                  right[1]?.stored_at
                  ?? 0,
                )
                - Number(
                  left[1]?.stored_at
                  ?? 0,
                ),
            )
            .slice(
              0,
              60,
            ),
        );

      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          trimmed,
        ),
      );
    } catch (_error) {
      // Cache is optional.
    }
  }

  function responseFromCache(
    entry,
  ) {
    const headers =
      new Headers(
        entry.headers
        ?? {},
      );

    headers.set(
      'X-Aquila-Finance-Cache',
      'HIT',
    );

    return new Response(
      entry.body,
      {
        status:
          entry.status
          ?? 200,

        headers,
      },
    );
  }

  async function saveResponse(
    key,
    response,
  ) {
    if (
      !response.ok
    ) {
      return;
    }

    const clone =
      response.clone();

    const body =
      await clone.text();

    try {
      JSON.parse(body);
    } catch (_error) {
      return;
    }

    const store =
      storeRead();

    store[key] = {
      stored_at:
        Date.now(),

      status:
        clone.status,

      headers: {
        'content-type':
          clone.headers.get(
            'content-type',
          )
          ?? 'application/json',
      },

      body,
    };

    storeWrite(
      store,
    );
  }

  async function networkRequest(
    key,
    input,
    init,
  ) {
    if (
      inflight.has(
        key,
      )
    ) {
      const shared =
        await inflight.get(
          key,
        );

      return shared.clone();
    }

    const promise =
      (
        async () => {
          diagnostics.network_fetches +=
            1;

          const response =
            await originalFetch(
              input,
              init,
            );

          await saveResponse(
            key,
            response,
          );

          return response;
        }
      )();

    inflight.set(
      key,
      promise,
    );

    try {
      const response =
        await promise;

      return response.clone();
    } finally {
      inflight.delete(
        key,
      );
    }
  }

  function revalidate(
    key,
    input,
    init,
  ) {
    if (
      revalidating.has(
        key,
      )
    ) {
      return;
    }

    diagnostics.revalidations +=
      1;

    const promise =
      (
        async () => {
          try {
            const response =
              await originalFetch(
                input,
                init,
              );

            await saveResponse(
              key,
              response,
            );
          } catch (_error) {
            // Stale result remains available.
          }
        }
      )();

    revalidating.set(
      key,
      promise,
    );

    promise.finally(
      () => {
        revalidating.delete(
          key,
        );
      },
    );
  }

  window.fetch =
    async function aquilaFinanceFetch(
      input,
      init,
    ) {
      if (
        !cacheable(
          input,
          init,
        )
      ) {
        return originalFetch(
          input,
          init,
        );
      }

      const key =
        cacheKey(input);

      const store =
        storeRead();

      const entry =
        store[key];

      if (
        entry
        && Number.isFinite(
          Number(
            entry.stored_at,
          ),
        )
      ) {
        const age =
          Date.now()
          - Number(
            entry.stored_at,
          );

        if (
          age <= CACHE_FRESH_MS
        ) {
          diagnostics.cache_hits +=
            1;

          return responseFromCache(
            entry,
          );
        }

        if (
          age <= CACHE_STALE_MS
        ) {
          diagnostics.stale_hits +=
            1;

          revalidate(
            key,
            input,
            init,
          );

          return responseFromCache(
            entry,
          );
        }

        delete store[key];

        storeWrite(
          store,
        );
      }

      return networkRequest(
        key,
        input,
        init,
      );
    };

  function core(payload) {
    if (
      payload?.data
      && typeof payload.data
      === 'object'
      && !Array.isArray(
        payload.data,
      )
    ) {
      return payload.data;
    }

    return payload
      ?? {};
  }

  function rows(payload) {
    const value =
      core(payload);

    const candidate =
      value.rows
      ?? value.items
      ?? value.data
      ?? [];

    if (
      Array.isArray(
        candidate,
      )
    ) {
      return candidate;
    }

    if (
      candidate
      && Array.isArray(
        candidate.data,
      )
    ) {
      return candidate.data;
    }

    return [];
  }

  function summary(payload) {
    return (
      core(payload).summary
      ?? payload?.summary
      ?? {}
    );
  }

  function series(payload) {
    const value =
      core(payload);

    for (
      const candidate
      of [
        value.series,
        value.trend,
        value.timeline,
        payload?.series,
      ]
    ) {
      if (
        Array.isArray(
          candidate,
        )
      ) {
        return candidate;
      }
    }

    return [];
  }

  function metric(
    payload,
    aliases,
  ) {
    const wanted =
      aliases.map(
        text,
      );

    const data =
      summary(payload);

    if (
      Array.isArray(
        data,
      )
    ) {
      for (
        const item
        of data
      ) {
        const identity =
          text(
            item?.key
            ?? item?.label
            ?? item?.name
            ?? item?.metric,
          );

        if (
          wanted.includes(
            identity,
          )
        ) {
          const value =
            number(
              item?.value
              ?? item?.amount
              ?? item?.total
              ?? item?.balance,
            );

          if (
            value !== null
          ) {
            return value;
          }
        }
      }
    }

    if (
      data
      && typeof data
      === 'object'
    ) {
      for (
        const [
          key,
          value,
        ]
        of Object.entries(
          data,
        )
      ) {
        if (
          wanted.includes(
            text(key),
          )
        ) {
          const parsed =
            number(
              value?.value
              ?? value?.amount
              ?? value?.total
              ?? value,
            );

          if (
            parsed !== null
          ) {
            return parsed;
          }
        }
      }
    }

    return null;
  }

  function accountCode(row) {
    return String(
      row?.code
      ?? row?.account_code
      ?? row?.chart_of_account_code
      ?? '',
    ).trim();
  }

  function accountBalance(row) {
    const direct =
      number(
        row?.balance
        ?? row?.amount
        ?? row?.net
        ?? row?.value,
      );

    if (
      direct !== null
    ) {
      return Math.abs(
        direct,
      );
    }

    const debit =
      number(
        row?.debit,
      )
      ?? 0;

    const credit =
      number(
        row?.credit,
      )
      ?? 0;

    const type =
      text(
        row?.account_type
        ?? row?.type,
      );

    if (
      [
        'liability',
        'income',
        'equity',
      ].includes(
        type,
      )
    ) {
      return Math.max(
        0,
        credit - debit,
      );
    }

    return Math.max(
      0,
      debit - credit,
    );
  }

  function pnlValues(payload) {
    const list =
      rows(payload);

    let income =
      metric(
        payload,
        [
          'total income',
          'income',
          'revenue',
          'total revenue',
        ],
      );

    let expenses =
      metric(
        payload,
        [
          'total expenses',
          'expenses',
        ],
      );

    let net =
      metric(
        payload,
        [
          'net profit',
          'net income',
          'profit',
        ],
      );

    let rowIncome =
      0;

    let rowExpenses =
      0;

    list.forEach(
      (row) => {
        const type =
          text(
            row?.account_type
            ?? row?.type,
          );

        const debit =
          number(
            row?.debit,
          )
          ?? 0;

        const credit =
          number(
            row?.credit,
          )
          ?? 0;

        if (
          type === 'income'
        ) {
          rowIncome +=
            Math.max(
              0,
              credit - debit,
            );
        }

        if (
          type === 'expense'
        ) {
          rowExpenses +=
            Math.max(
              0,
              debit - credit,
            );
        }
      },
    );

    if (
      income === null
    ) {
      income =
        rowIncome;
    }

    if (
      expenses === null
    ) {
      expenses =
        rowExpenses;
    }

    if (
      net === null
    ) {
      net =
        income
        - expenses;
    }

    const cogsRow =
      list.find(
        (row) =>
          accountCode(row)
          === '5000',
      );

    const cogs =
      cogsRow
        ? accountBalance(
          cogsRow,
        )
        : 0;

    const grossMargin =
      income !== 0
        ? (
          (
            income - cogs
          )
          / income
          * 100
        )
        : 0;

    return {
      income,
      expenses,
      net,
      cogs,
      grossMargin,
    };
  }

  function routeIsOverview() {
    const params =
      new URLSearchParams(
        location.hash.replace(
          /^#/,
          '',
        ),
      );

    return (
      params.get(
        'section',
      )
      === 'finance'
      && params.get(
        'finance',
      )
      === 'overview'
    );
  }

  function overviewRoot() {
    return (
      document.querySelector(
        '[data-finance-approved-overview="active"]',
      )
      ?? document.querySelector(
        '.finance-overview',
      )
      ?? null
    );
  }

  function exactText(
    root,
    labels,
  ) {
    const wanted =
      labels.map(
        text,
      );

    const nodes =
      root.querySelectorAll(
        'span,small,p,label,h2,h3,h4,strong',
      );

    return Array.from(
      nodes,
    ).find(
      (node) =>
        wanted.includes(
          text(
            node.textContent,
          ),
        ),
    )
      ?? null;
  }

  function setCard(
    root,
    labels,
    value,
  ) {
    const label =
      exactText(
        root,
        labels,
      );

    if (!label) {
      return false;
    }

    const card =
      label.closest(
        'article',
      )
      ?? label.closest(
        '[class*="card"]',
      )
      ?? label.parentElement;

    if (!card) {
      return false;
    }

    const candidates =
      Array.from(
        card.querySelectorAll(
          'strong,[data-kpi-value],[class*="value"]',
        ),
      );

    const target =
      candidates.find(
        (node) =>
          node !== label
          && !labels
            .map(text)
            .includes(
              text(
                node.textContent,
              ),
            ),
      );

    if (!target) {
      return false;
    }

    if (
      value !== '—'
      || [
        '',
        '—',
        '-',
        'loading',
      ].includes(
        text(
          target.textContent,
        ),
      )
    ) {
      target.textContent =
        value;
    }

    target.setAttribute(
      'data-aquila-finance-live-value',
      'r1-2-r2',
    );

    return true;
  }

  function panel(
    root,
    labels,
  ) {
    const heading =
      exactText(
        root,
        labels,
      );

    if (!heading) {
      return null;
    }

    return (
      heading.closest(
        'article',
      )
      ?? heading.closest(
        'section',
      )
      ?? heading.parentElement
    );
  }

  function meaningfulRows(tbody) {
    return Array.from(
      tbody?.querySelectorAll(
        ':scope > tr',
      )
      ?? [],
    ).filter(
      (row) => {
        const value =
          text(
            row.textContent,
          );

        return (
          value
          && !value.includes(
            'loading',
          )
          && !value.includes(
            'no data',
          )
          && !value.includes(
            'no records',
          )
        );
      },
    );
  }

  function preserveAndLimit(
    targetPanel,
  ) {
    const tbody =
      targetPanel?.querySelector(
        'tbody',
      );

    if (!tbody) {
      return 0;
    }

    const valid =
      meaningfulRows(
        tbody,
      );

    if (!valid.length) {
      return 0;
    }

    valid.forEach(
      (
        row,
        index,
      ) => {
        row.hidden =
          index >=
          DEFAULT_TABLE_ROWS;
      },
    );

    return Math.min(
      valid.length,
      DEFAULT_TABLE_ROWS,
    );
  }

  function pick(
    source,
    keys,
  ) {
    for (
      const key
      of keys
    ) {
      const value =
        source?.[key];

      if (
        value !== null
        && value !== undefined
        && String(value).trim()
      ) {
        return value;
      }
    }

    return null;
  }

  function valueForColumn(
    heading,
    row,
  ) {
    const key =
      text(heading);

    if (
      key.includes(
        'date',
      )
      || key.includes(
        'due',
      )
    ) {
      return pick(
        row,
        [
          'due_date',
          'business_date',
          'sold_at',
          'date',
          'created_at',
        ],
      );
    }

    if (
      key.includes(
        'customer',
      )
    ) {
      return pick(
        row,
        [
          'customer_name',
          'customer',
          'name',
        ],
      );
    }

    if (
      key.includes(
        'supplier',
      )
    ) {
      return pick(
        row,
        [
          'supplier_name',
          'supplier',
          'name',
        ],
      );
    }

    if (
      key.includes(
        'reference',
      )
      || key.includes(
        'invoice',
      )
      || key.includes(
        'transaction',
      )
      || key.includes(
        'order',
      )
    ) {
      return pick(
        row,
        [
          'sale_number',
          'invoice_number',
          'po_number',
          'reference_number',
          'number',
          'code',
          'id',
        ],
      );
    }

    if (
      key.includes(
        'account',
      )
    ) {
      return pick(
        row,
        [
          'name',
          'account_name',
          'code',
          'account_code',
        ],
      );
    }

    if (
      key.includes(
        'status',
      )
    ) {
      return pick(
        row,
        [
          'payment_status',
          'status',
          'state',
        ],
      );
    }

    if (
      key.includes(
        'amount',
      )
      || key.includes(
        'balance',
      )
      || key.includes(
        'value',
      )
      || key.includes(
        'total',
      )
      || key.includes(
        'outstanding',
      )
    ) {
      const result =
        pick(
          row,
          [
            'balance_amount',
            'outstanding_amount',
            'outstanding',
            'total_amount',
            'amount',
            'balance',
          ],
        );

      return result === null
        ? null
        : money(result);
    }

    return pick(
      row,
      [
        'sale_number',
        'po_number',
        'business_date',
        'name',
        'status',
        'amount',
      ],
    );
  }

  function populateTable(
    targetPanel,
    sourceRows,
  ) {
    const tbody =
      targetPanel?.querySelector(
        'tbody',
      );

    if (!tbody) {
      return 0;
    }

    const list =
      sourceRows
        .filter(Boolean)
        .slice(
          0,
          DEFAULT_TABLE_ROWS,
        );

    if (!list.length) {
      return 0;
    }

    const headings =
      Array.from(
        targetPanel.querySelectorAll(
          'thead th',
        ),
      ).map(
        (heading) =>
          heading.textContent
          ?? '',
      );

    const fragment =
      document.createDocumentFragment();

    list.forEach(
      (item) => {
        const tr =
          document.createElement(
            'tr',
          );

        tr.setAttribute(
          'data-aquila-finance-default-row',
          'r1-2-r2',
        );

        const columns =
          headings.length
            ? headings
            : [
              'Reference',
              'Date',
              'Amount',
              'Status',
            ];

        columns.forEach(
          (heading) => {
            const td =
              document.createElement(
                'td',
              );

            const value =
              valueForColumn(
                heading,
                item,
              );

            td.textContent =
              value === null
              || value === undefined
              || String(value).trim()
                === ''
                ? '—'
                : String(value);

            tr.appendChild(
              td,
            );
          },
        );

        fragment.appendChild(
          tr,
        );
      },
    );

    tbody.replaceChildren(
      fragment,
    );

    return list.length;
  }

  function bindTable(
    root,
    labels,
    sourceRows,
  ) {
    const target =
      panel(
        root,
        labels,
      );

    if (!target) {
      return 0;
    }

    const existing =
      preserveAndLimit(
        target,
      );

    if (
      existing > 0
    ) {
      return existing;
    }

    return populateTable(
      target,
      sourceRows,
    );
  }

  function seriesPoints(
    payload,
    aliases,
  ) {
    const wanted =
      aliases.map(
        text,
      );

    const result =
      [];

    series(payload).forEach(
      (
        row,
        index,
      ) => {
        if (
          !row
          || typeof row
          !== 'object'
        ) {
          return;
        }

        let value =
          null;

        for (
          const alias
          of aliases
        ) {
          const direct =
            number(
              row?.[alias],
            );

          if (
            direct !== null
          ) {
            value =
              direct;
            break;
          }
        }

        if (
          value === null
        ) {
          const identity =
            text(
              row?.key
              ?? row?.name
              ?? row?.series
              ?? row?.metric,
            );

          if (
            wanted.includes(
              identity,
            )
          ) {
            value =
              number(
                row?.value
                ?? row?.amount
                ?? row?.total,
              );
          }
        }

        if (
          value !== null
        ) {
          result.push({
            label:
              String(
                row?.date
                ?? row?.business_date
                ?? row?.period
                ?? row?.label
                ?? (
                  index + 1
                ),
              ),

            value,
          });
        }
      },
    );

    return result;
  }

  function addLabels(
    targetPanel,
    definitions,
  ) {
    const svg =
      targetPanel?.querySelector(
        'svg',
      );

    if (!svg) {
      return 0;
    }

    svg.querySelectorAll(
      '[data-aquila-finance-data-label="r1-2-r2"]',
    ).forEach(
      (node) =>
        node.remove(),
    );

    const usable =
      definitions.filter(
        (definition) =>
          definition.points.length,
      );

    const values =
      usable.flatMap(
        (definition) =>
          definition.points.map(
            (point) =>
              point.value,
          ),
      );

    if (!values.length) {
      return 0;
    }

    const box =
      svg.viewBox?.baseVal;

    const width =
      box?.width
      || 100;

    const height =
      box?.height
      || 40;

    const minimum =
      Math.min(
        0,
        ...values,
      );

    const maximum =
      Math.max(
        1,
        ...values,
      );

    const range =
      Math.max(
        maximum
        - minimum,
        1,
      );

    const namespace =
      'http://www.w3.org/2000/svg';

    let total =
      0;

    usable.forEach(
      (
        definition,
        definitionIndex,
      ) => {
        definition.points.forEach(
          (
            point,
            index,
          ) => {
            const x =
              definition.points.length
              <= 1
                ? width / 2
                : (
                  4
                  + (
                    (
                      width - 8
                    )
                    * index
                    / (
                      definition.points.length
                      - 1
                    )
                  )
                );

            const ratio =
              (
                point.value
                - minimum
              )
              / range;

            let y =
              (
                height - 5
              )
              - (
                (
                  height - 12
                )
                * ratio
              );

            y +=
              definitionIndex % 2
              === 0
                ? -2
                : 2;

            y =
              Math.max(
                4,
                Math.min(
                  height - 3,
                  y,
                ),
              );

            const label =
              document.createElementNS(
                namespace,
                'text',
              );

            label.setAttribute(
              'data-aquila-finance-data-label',
              'r1-2-r2',
            );

            label.setAttribute(
              'x',
              x.toFixed(2),
            );

            label.setAttribute(
              'y',
              y.toFixed(2),
            );

            label.setAttribute(
              'text-anchor',
              index === 0
                ? 'start'
                : index
                  === definition.points.length
                  - 1
                    ? 'end'
                    : 'middle',
            );

            label.setAttribute(
              'font-size',
              '3',
            );

            label.setAttribute(
              'font-weight',
              '700',
            );

            label.setAttribute(
              'fill',
              'currentColor',
            );

            label.textContent =
              compact(
                point.value,
              );

            svg.appendChild(
              label,
            );

            total +=
              1;
          },
        );
      },
    );

    return total;
  }

  function dateRange() {
    const now =
      new Date();

    const from =
      [
        now.getFullYear(),

        String(
          now.getMonth()
          + 1,
        ).padStart(
          2,
          '0',
        ),

        '01',
      ].join('-');

    const to =
      [
        now.getFullYear(),

        String(
          now.getMonth()
          + 1,
        ).padStart(
          2,
          '0',
        ),

        String(
          now.getDate(),
        ).padStart(
          2,
          '0',
        ),
      ].join('-');

    return {
      from,
      to,
    };
  }

  async function api(
    url,
  ) {
    const context =
      sessionContext();

    if (
      !context.token
      || !context.tenantSlug
    ) {
      throw new Error(
        'Authenticated Finance context is not ready.',
      );
    }

    const response =
      await window.fetch(
        url,
        {
          headers: {
            Accept:
              'application/json',

            Authorization:
              'Bearer '
              + context.token,

            'X-Tenant-Slug':
              context.tenantSlug,
          },

          cache:
            'no-store',

          credentials:
            'same-origin',
        },
      );

    if (
      !response.ok
    ) {
      const error =
        new Error(
          'HTTP '
          + response.status
          + ' '
          + url,
        );

      error.status =
        response.status;

      throw error;
    }

    return response.json();
  }

  function commercial(
    endpoint,
    range,
    perPage,
  ) {
    const params =
      new URLSearchParams();

    if (range) {
      params.set(
        'from',
        range.from,
      );

      params.set(
        'to',
        range.to,
      );
    }

    if (perPage) {
      params.set(
        'per_page',
        String(perPage),
      );
    }

    return (
      FINANCE_PREFIX
      + endpoint
      + (
        params.toString()
          ? '?'
            + params.toString()
          : ''
      )
    );
  }

  async function loadOverview() {
    if (
      !routeIsOverview()
    ) {
      return false;
    }

    const root =
      overviewRoot();

    if (!root) {
      throw new Error(
        'Finance Overview DOM not mounted yet.',
      );
    }

    const range =
      dateRange();

    const requests = [
      [
        'overview',
        commercial(
          'overview',
          range,
          5,
        ),
      ],

      [
        'pnl',
        commercial(
          'profit-loss',
          range,
          200,
        ),
      ],

      [
        'cashflow',
        commercial(
          'cash-flow',
          range,
          50,
        ),
      ],

      [
        'sales',
        commercial(
          'sales',
          range,
          5,
        ),
      ],

      [
        'receivables',
        commercial(
          'receivables',
          range,
          5,
        ),
      ],

      [
        'flow',
        commercial(
          'flow',
          range,
          5,
        ),
      ],

      [
        'trial',
        TRIAL_BALANCE_URL,
      ],

      [
        'purchase-orders',
        PURCHASE_ORDER_URL
        + '?per_page=5',
      ],
    ];

    const settled =
      await Promise.allSettled(
        requests.map(
          (
            [
              _name,
              url,
            ],
          ) =>
            api(url),
        ),
      );

    const payload = {};

    requests.forEach(
      (
        [
          name,
        ],
        index,
      ) => {
        const result =
          settled[index];

        if (
          result.status
          === 'fulfilled'
        ) {
          payload[name] =
            result.value;

          diagnostics.last_sources[
            name
          ] = 'ok';
        } else {
          payload[name] =
            null;

          diagnostics.last_sources[
            name
          ] = (
            'error:'
            + String(
              result.reason?.status
              ?? result.reason?.message
              ?? 'failed',
            )
          );
        }
      },
    );;window.__AQUILA_FINANCE_NATIVE_DATA_R1__.publish("overview",{payload:payload,settled:settled});

    const pnl =
      pnlValues(
        payload.pnl,
      );

    const trialRows =
      rows(
        payload.trial,
      );

    function trialValue(
      code,
      aliases,
    ) {
      const account =
        trialRows.find(
          (row) =>
            accountCode(row)
            === code,
        );

      if (account) {
        return accountBalance(
          account,
        );
      }

      return metric(
        payload.overview,
        aliases,
      );
    }

    const cards = [
      {
        labels: [
          'Total Revenue',
        ],

        value:
          money(
            pnl.income,
          ),
      },

      {
        labels: [
          'Gross Margin',
        ],

        value:
          percent(
            pnl.grossMargin,
          ),
      },

      {
        labels: [
          'Total Expenses',
        ],

        value:
          money(
            pnl.expenses,
          ),
      },

      {
        labels: [
          'Net Profit',
        ],

        value:
          money(
            pnl.net,
          ),
      },

      {
        labels: [
          'Cash in Hand',
          'Cash on Hand',
        ],

        value:
          money(
            trialValue(
              '1000',
              [
                'cash in hand',
                'cash on hand',
                'cash',
              ],
            ),
          ),
      },

      {
        labels: [
          'Insurance Receivables',
          'Insurance Receivable',
        ],

        value:
          money(
            trialValue(
              '1110',
              [
                'insurance receivables',
                'insurance receivable',
              ],
            ),
          ),
      },

      {
        labels: [
          'Accounts Payable',
          'Account Payables',
          'Accounts Payables',
        ],

        value:
          money(
            trialValue(
              '2000',
              [
                'accounts payable',
                'account payables',
                'payables',
              ],
            ),
          ),
      },

      {
        labels: [
          'Inventory Value',
        ],

        value:
          money(
            trialValue(
              '1200',
              [
                'inventory value',
                'inventory',
              ],
            ),
          ),
      },
    ];

    diagnostics.cards_bound =
      cards.reduce(
        (
          total,
          item,
        ) =>
          total
          + (
            setCard(
              root,
              item.labels,
              item.value,
            )
              ? 1
              : 0
          ),

        0,
      );

    diagnostics.table_rows
      .recent_transactions =
        bindTable(
          root,

          [
            'Recent Transactions',
          ],

          rows(
            payload.sales,
          ),
        );

    diagnostics.table_rows
      .top_receivables =
        bindTable(
          root,

          [
            'Top Receivables',
          ],

          rows(
            payload.receivables,
          )
            .slice()
            .sort(
              (
                left,
                right,
              ) =>
                (
                  number(
                    right?.balance_amount
                    ?? right?.outstanding_amount
                    ?? right?.outstanding,
                  )
                  ?? 0
                )
                - (
                  number(
                    left?.balance_amount
                    ?? left?.outstanding_amount
                    ?? left?.outstanding,
                  )
                  ?? 0
                ),
            ),
        );

    const flowRows =
      rows(
        payload.flow,
      );

    const purchaseOrderRows =
      rows(
        payload[
          'purchase-orders'
        ],
      );

    diagnostics.table_rows
      .upcoming_payables =
        bindTable(
          root,

          [
            'Upcoming Payables',
          ],

          flowRows.length
            ? flowRows
            : purchaseOrderRows,
        );

    const liquidRows =
      trialRows.filter(
        (row) =>
          [
            '1000',
            '1010',
            '1020',
            '1030',
          ].includes(
            accountCode(row),
          ),
      );

    diagnostics.table_rows
      .bank_accounts =
        bindTable(
          root,

          [
            'Bank & Cash Accounts',
            'Bank Accounts',
            'Bank Account',
          ],

          liquidRows,
        );

    const revenuePanel =
      panel(
        root,
        [
          'Revenue vs Expenses Trend',
          'Revenue vs Expenses',
        ],
      );

    const cashPanel =
      panel(
        root,
        [
          'Cash Flow Overview',
          'Cash Flow Trend',
        ],
      );

    diagnostics.trend_labels_rendered =
      0
      + 0;

    diagnostics.last_apply_at =
      new Date().toISOString();

    diagnostics.last_error =
      null;

    root.setAttribute(
      'data-aquila-finance-overview-live',
      'r1-2-r2',
    );

    return true;
  }

  let generation =
    0;

  function schedule(
    reason,
  ) {
    generation +=
      1;

    const current =
      generation;

    RETRY_DELAYS.forEach(
      (delay) => {
        setTimeout(
          async () => {
            if (
              current
              !== generation
              || !routeIsOverview()
            ) {
              return;
            }

            try {
              await loadOverview();
            } catch (error) {
              diagnostics.last_error =
                String(
                  error?.message
                  ?? error,
                );
            }
          },

          delay,
        );
      },
    );

    return reason;
  }

  window.addEventListener(
    'hashchange',
    () =>
      schedule(
        'hashchange',
      ),
    {
      passive:
        true,
    },
  );

  window.addEventListener(
    'pageshow',
    () =>
      schedule(
        'pageshow',
      ),
    {
      passive:
        true,
    },
  );

  window.addEventListener(
    'load',
    () =>
      schedule(
        'load',
      ),
    {
      once:
        true,

      passive:
        true,
    },
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        document.visibilityState
        === 'visible'
      ) {
        schedule(
          'visibilitychange',
        );
      }
    },
  );

  document.addEventListener(
    'change',
    (event) => {
      if (
        !routeIsOverview()
      ) {
        return;
      }

      if (
        event.target
        instanceof Element
        && event.target.matches(
          'input,select',
        )
      ) {
        schedule(
          'filter-change',
        );
      }
    },
    {
      passive:
        true,
    },
  );

  if (
    document.readyState
    === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      () =>
        schedule(
          'dom-ready',
        ),
      {
        once:
          true,
      },
    );
  } else {
    schedule(
      'immediate',
    );
  }

  window.__AQUILA_FINANCE_OVERVIEW_APPLY_R2_4__ =
    () => loadOverview();

  window
    .__AQUILA_FINANCE_CACHE_OVERVIEW_R1_2_R2__ =
      {
        diagnostics() {
          return JSON.parse(
            JSON.stringify(
              {
                ...diagnostics,

                cache_storage:
                  'sessionStorage',

                cache_fresh_seconds:
                  CACHE_FRESH_MS
                  / 1000,

                cache_stale_seconds:
                  CACHE_STALE_MS
                  / 1000,

                stale_while_revalidate:
                  true,

                request_deduplication:
                  true,

                default_table_rows:
                  DEFAULT_TABLE_ROWS,

                retry_schedule_ms:
                  RETRY_DELAYS,
              },
            ),
          );
        },

        async refresh() {
          sessionStorage.removeItem(
            STORAGE_KEY,
          );

          generation +=
            1;

          return loadOverview();
        },
      };

  window
    .__AQUILA_FINANCE_CACHE_OVERVIEW_R1_2_R2_INSTALLED__ =
      true;


window.__AQUILA_FINANCE_OVERVIEW_R2_9_10__={
  version:'R2.9.10',

  architecture:
    'EXISTING_SPECIALIZED_OVERVIEW_OWNER',

  rootReady:function(){
    try{
      return !!overviewRoot();
    }catch(_){
      return false;
    }
  },

  apply:function(){
    return loadOverview();
  },

  diagnose:function(){
    try{
      return {
        version:'R2.9.10',
        rootReady:
          !!overviewRoot(),
        loader:
          'loadOverview',
        route:
          String(
            location.hash ||
            ''
          ),
        diagnostics:
          JSON.parse(
            JSON.stringify(
              diagnostics
            )
          )
      };
    }catch(error){
      return {
        version:'R2.9.10',
        error:
          error &&
          error.message
            ? error.message
            : String(error)
      };
    }
  }
};

}());

(() => {
  'use strict';

  const RELEASE =
    'AQUILA_FINANCE_EXISTING_UI_DATA_BINDING_R1';

  const LOADING_FIX =
    'AQUILA_FINANCE_EXISTING_UI_LOADING_FIX_R1_1';

  const SESSION_KEY =
    'ubuzima_admin_session';

  const COMMERCIAL_PREFIX =
    '/api/v1/pharmaco/finance/commercial/';

  const CACHE_MS = 10000;

  const modules = {
    overview: {
      endpoint: 'overview',
      label: 'Finance Overview',
    },

    'finance-flow': {
      endpoint: 'flow',
      label: 'Finance Flow',
    },

    'exception-focus': {
      endpoint: 'exceptions',
      label: 'Exception Focus',
    },

    'credits-receivables': {
      endpoint: 'receivables',
      label: 'Customer Credits / Receivables',
    },

    'receivable-register': {
      endpoint: 'receivable-register',
      label: 'Receivable Register',
    },

    collection: {
      endpoint: 'collections',
      label: 'Collection',
    },

    'financial-statements': {
      endpoint: 'profit-loss',
      label: 'Profit & Loss',
    },

    'cash-flow': {
      endpoint: 'cash-flow',
      label: 'Cash Flow',
    },

    sales: {
      endpoint: 'sales',
      label: 'Sales',
    },

    accounting: {
      url: '/api/v1/pharmaco/accounting/overview',
      label: 'Accounting',
      native: true,
    },
  };

  const cache = new Map();

  const diagnostics = {
    release: RELEASE,
    started_at:
      new Date().toISOString(),
    active_module: null,
    tenant_slug: null,
    modules: {},
    source_health: null,
    last_binding: null,
    errors: [],
  };

  window
    .__AQUILA_FINANCE_LIVE_DATA_R1_DIAGNOSTICS__ =
      () =>
        JSON.parse(
          JSON.stringify(
            diagnostics,
          ),
        );

  function normalizeText(value) {
    return String(
      value ?? '',
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^\p{L}\p{N}]+/gu,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  function number(value) {
    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function setText(
    element,
    value,
  ) {
    if (!element) {
      return false;
    }

    const next =
      String(value ?? '');

    if (
      element.textContent
      === next
    ) {
      return false;
    }

    element.textContent =
      next;

    return true;
  }

  function money(value) {
    return (
      'RWF '
      + new Intl.NumberFormat(
        'en-US',
        {
          maximumFractionDigits: 2,
          minimumFractionDigits: 0,
        },
      ).format(
        number(value),
      )
    );
  }

  function count(value) {
    return new Intl.NumberFormat(
      'en-US',
      {
        maximumFractionDigits: 0,
      },
    ).format(
      number(value),
    );
  }

  function percent(value) {
    return (
      new Intl.NumberFormat(
        'en-US',
        {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        },
      ).format(
        number(value),
      )
      + '%'
    );
  }

  function valueFormat(
    value,
    type,
  ) {
    const normalized =
      normalizeText(type);

    if (
      normalized.includes(
        'money',
      )
      || normalized.includes(
        'currency',
      )
      || normalized.includes(
        'amount',
      )
    ) {
      return money(value);
    }

    if (
      normalized.includes(
        'percent',
      )
      || normalized.includes(
        'ratio',
      )
    ) {
      return percent(value);
    }

    if (
      normalized.includes(
        'number',
      )
      || normalized.includes(
        'count',
      )
    ) {
      return count(value);
    }

    if (
      typeof value
      === 'number'
    ) {
      return count(value);
    }

    return String(
      value ?? '—',
    );
  }

  function routeState() {
    const raw =
      window.location.hash
        .replace(/^#/, '');

    const params =
      new URLSearchParams(
        raw,
      );

    return {
      section:
        params.get(
          'section',
        ),
      finance:
        params.get(
          'finance',
        )
        || 'overview',
    };
  }

  function isFinanceRoute() {
    return (
      routeState().section
      === 'finance'
    );
  }

  function tenantSlugFromProfile(
    profile,
  ) {
    const assignments =
      Array.isArray(
        profile
          ?.tenant_assignments,
      )
        ? profile
            .tenant_assignments
        : (
          Array.isArray(
            profile
              ?.tenantAssignments,
          )
            ? profile
                .tenantAssignments
            : []
        );

    const scopeTenantId =
      profile
        ?.scope
        ?.tenant_id;

    const active =
      assignments.filter(
        (assignment) =>
          normalizeText(
            assignment?.status
            ?? 'active',
          )
          === 'active',
      );

    const scoped =
      assignments.find(
        (assignment) =>
          scopeTenantId != null
          && String(
            assignment
              ?.tenant
              ?.id
            ?? assignment
              ?.tenant_id
            ?? '',
          )
          === String(
            scopeTenantId,
          ),
      );

    const selected =
      scoped
      ?? active[0]
      ?? assignments[0]
      ?? null;

    const slug =
      selected
        ?.tenant
        ?.slug
      ?? selected
        ?.tenant_slug
      ?? profile
        ?.tenant
        ?.slug
      ?? null;

    return (
      typeof slug
        === 'string'
      && slug.trim()
    )
      ? slug.trim()
      : null;
  }

  function sessionContext() {
    const raw =
      window.localStorage
        .getItem(
          SESSION_KEY,
        );

    if (!raw) {
      throw new Error(
        'Authenticated Admin session is not available yet.',
      );
    }

    let stored;

    try {
      stored =
        JSON.parse(raw);
    } catch {
      throw new Error(
        'Authenticated Admin session could not be read.',
      );
    }

    const token =
      stored?.token
      ?? stored?.access_token
      ?? stored?.accessToken
      ?? null;

    const profile =
      stored?.profile
      ?? stored?.user?.profile
      ?? stored?.user
      ?? null;

    if (
      typeof token
        !== 'string'
      || !token.trim()
    ) {
      throw new Error(
        'Authenticated Admin token is unavailable.',
      );
    }

    const tenantSlug =
      tenantSlugFromProfile(
        profile,
      );

    if (!tenantSlug) {
      throw new Error(
        'Authenticated tenant could not be resolved from the current profile.',
      );
    }

    diagnostics.tenant_slug =
      tenantSlug;

    return {
      token:
        token.trim(),
      profile,
      tenantSlug,
    };
  }

  function normalizePayload(body) {
    const data =
      body
        ?.data
      ?? body
      ?? {};

    let rows =
      data?.rows
      ?? [];

    if (
      rows
      && !Array.isArray(rows)
      && Array.isArray(
        rows.data,
      )
    ) {
      rows =
        rows.data;
    }

    let summary =
      data?.summary
      ?? [];

    if (
      summary
      && !Array.isArray(
        summary,
      )
      && typeof summary
        === 'object'
    ) {
      summary =
        Object.entries(
          summary,
        ).map(
          ([key, value]) => ({
            key,
            label: key,
            value,
          }),
        );
    }

    const columns =
      Array.isArray(
        data?.columns,
      )
        ? data.columns
        : [];

    const series =
      Array.isArray(
        data?.series,
      )
        ? data.series
        : [];

    const sourceHealth =
      data?.source_health
      ?? data?.sourceHealth
      ?? [];

    const seriesLabels =
      data?.series_labels
      ?? data?.seriesLabels
      ?? {};

    return {
      raw: body,
      data,
      rows:
        Array.isArray(rows)
          ? rows
          : [],
      summary:
        Array.isArray(summary)
          ? summary
          : [],
      columns,
      series,
      sourceHealth,
      seriesLabels,
    };
  }

  async function requestJson(
    url,
    diagnosticKey,
    maxAge = CACHE_MS,
  ) {
    const now =
      Date.now();

    const existing =
      cache.get(url);

    if (
      existing
      && (
        now
        - existing.at
      ) < maxAge
    ) {
      return existing.payload;
    }

    const {
      token,
      tenantSlug,
    } =
      sessionContext();

    const started =
      performance.now();

    let response;

    try {
      response =
        await fetch(
          url,
          {
            headers: {
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
              'X-Tenant-Slug':
                tenantSlug,
            },
            credentials:
              'same-origin',
            cache:
              'no-store',
          },
        );
    } catch (error) {
      diagnostics.modules[
        diagnosticKey
      ] = {
        status:
          'network-error',
        endpoint: url,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        at:
          new Date()
            .toISOString(),
      };

      throw error;
    }

    let body = {};

    try {
      body =
        await response.json();
    } catch {
      body = {};
    }

    const elapsed =
      Math.round(
        performance.now()
        - started,
      );

    if (!response.ok) {
      const message =
        String(
          body?.message
          ?? (
            'Finance data request failed with HTTP '
            + response.status
          ),
        );

      diagnostics.modules[
        diagnosticKey
      ] = {
        status:
          'http-error',
        endpoint: url,
        http_status:
          response.status,
        elapsed_ms:
          elapsed,
        error:
          message,
        at:
          new Date()
            .toISOString(),
      };

      const error =
        new Error(message);

      error.httpStatus =
        response.status;

      throw error;
    }

    const payload =
      normalizePayload(
        body,
      );

    cache.set(
      url,
      {
        at: now,
        payload,
      },
    );

    diagnostics.modules[
      diagnosticKey
    ] = {
      status:
        'loaded',
      endpoint: url,
      http_status:
        response.status,
      elapsed_ms:
        elapsed,
      rows:
        payload.rows.length,
      summary:
        payload.summary.length,
      series:
        payload.series.length,
      at:
        new Date()
          .toISOString(),
    };

    return payload;
  }

  function commercialUrl(
    endpoint,
    params = {},
  ) {
    const query =
      new URLSearchParams();

    Object.entries(
      params,
    ).forEach(
      ([key, value]) => {
        if (
          value !== null
          && value !== undefined
          && String(value) !== ''
        ) {
          query.set(
            key,
            String(value),
          );
        }
      },
    );

    const suffix =
      query.toString();

    return (
      COMMERCIAL_PREFIX
      + endpoint
      + (
        suffix
          ? `?${suffix}`
          : ''
      )
    );
  }

  async function fetchModule(
    moduleKey,
    params = {},
  ) {
    const config =
      modules[moduleKey];

    if (!config) {
      throw new Error(
        'Unknown Finance module: '
        + moduleKey,
      );
    }

    if (config.url) {
      return requestJson(
        config.url,
        moduleKey,
      );
    }

    return requestJson(
      commercialUrl(
        config.endpoint,
        params,
      ),
      moduleKey,
    );
  }

  function localIsoDate(
    date,
  ) {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth()
        + 1,
      ).padStart(
        2,
        '0',
      );

    const day =
      String(
        date.getDate(),
      ).padStart(
        2,
        '0',
      );

    return (
      year
      + '-'
      + month
      + '-'
      + day
    );
  }

  function defaultPeriods() {
    const today =
      new Date();

    const currentFrom =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      );

    const previousTo =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        0,
      );

    const previousFrom =
      new Date(
        previousTo.getFullYear(),
        previousTo.getMonth(),
        1,
      );

    return {
      from:
        localIsoDate(
          currentFrom,
        ),
      to:
        localIsoDate(
          today,
        ),
      comparisonFrom:
        localIsoDate(
          previousFrom,
        ),
      comparisonTo:
        localIsoDate(
          previousTo,
        ),
    };
  }

  function periodsFromRoot(
    root,
  ) {
    const defaults =
      defaultPeriods();

    if (!root) {
      return defaults;
    }

    const inputs =
      Array.from(
        root.querySelectorAll(
          'input[type="date"]',
        ),
      );

    return {
      from:
        inputs[0]?.value
        || defaults.from,
      to:
        inputs[1]?.value
        || defaults.to,
      comparisonFrom:
        inputs[2]?.value
        || defaults.comparisonFrom,
      comparisonTo:
        inputs[3]?.value
        || defaults.comparisonTo,
    };
  }

  async function fetchPeriodPair(
    moduleKey,
    root,
  ) {
    const periods =
      periodsFromRoot(
        root,
      );

    const current =
      await fetchModule(
        moduleKey,
        {
          from:
            periods.from,
          to:
            periods.to,
          page: 1,
          per_page: 200,
        },
      );

    const comparison =
      await fetchModule(
        moduleKey,
        {
          from:
            periods.comparisonFrom,
          to:
            periods.comparisonTo,
          page: 1,
          per_page: 200,
        },
      );

    return {
      periods,
      current,
      comparison,
    };
  }

  function visible(
    element,
  ) {
    return Boolean(
      element
      && (
        element.getClientRects()
          .length > 0
        || element.offsetParent
          !== null
      ),
    );
  }

  function rootForModule(
    moduleKey,
  ) {
    if (
      moduleKey
      === 'financial-statements'
    ) {
      const pnl =
        document.querySelector(
          '.profit-loss-v1',
        );

      if (visible(pnl)) {
        return pnl;
      }
    }

    if (
      moduleKey
      === 'cash-flow'
    ) {
      const cash =
        document.querySelector(
          '.cash-flow-v1',
        );

      if (visible(cash)) {
        return cash;
      }
    }

    if (
      moduleKey
      === 'accounting'
    ) {
      const accounting =
        document.querySelector(
          '.acct-workspace',
        );

      if (visible(accounting)) {
        return accounting;
      }
    }

    const directStage =
      document.querySelector(
        '[data-finance-module-stage="active"]',
      );

    if (
      visible(
        directStage,
      )
    ) {
      return directStage;
    }

    const expected =
      normalizeText(
        modules[moduleKey]
          ?.label
        ?? '',
      );

    const headings =
      Array.from(
        document.querySelectorAll(
          'h1, h2, h3',
        ),
      );

    const heading =
      headings.find(
        (candidate) => {
          if (
            !visible(candidate)
          ) {
            return false;
          }

          const text =
            normalizeText(
              candidate.textContent,
            );

          return (
            text === expected
            || (
              expected
              && text.includes(
                expected,
              )
            )
          );
        },
      );

    if (heading) {
      return (
        heading.closest(
          '[data-finance-module-stage], .module-section-stage, .dedicated-module-page',
        )
        || heading.closest(
          'section',
        )
        || heading.parentElement
      );
    }

    const stages =
      Array.from(
        document.querySelectorAll(
          '.module-section-stage',
        ),
      );

    return (
      stages.find(
        visible,
      )
      ?? null
    );
  }

  function metricMap(
    payload,
  ) {
    const map =
      new Map();

    payload.summary
      .forEach(
        (metric) => {
          const keys = [
            metric?.key,
            metric?.label,
            metric?.name,
          ];

          keys.forEach(
            (key) => {
              const normalized =
                normalizeText(
                  key,
                );

              if (normalized) {
                map.set(
                  normalized,
                  metric,
                );
              }
            },
          );
        },
      );

    return map;
  }

  function metricByKey(
    payload,
    ...keys
  ) {
    const map =
      metricMap(
        payload,
      );

    for (
      const key of keys
    ) {
      const normalized =
        normalizeText(
          key,
        );

      if (
        map.has(
          normalized,
        )
      ) {
        return map.get(
          normalized,
        );
      }
    }

    return null;
  }

  function metricNumber(
    payload,
    ...keys
  ) {
    const metric =
      metricByKey(
        payload,
        ...keys,
      );

    return number(
      metric?.value
      ?? metric?.amount
      ?? 0,
    );
  }

  function looksLikeValue(
    value,
  ) {
    const text =
      String(
        value ?? '',
      ).trim();

    if (!text) {
      return true;
    }

    return (
      text === '—'
      || text === '-'
      || /RWF/i.test(text)
      || /%/.test(text)
      || /[0-9]/.test(text)
      || /no data/i.test(text)
      || /loading/i.test(text)
    );
  }

  function bindGenericSummary(
    root,
    payload,
  ) {
    if (!root) {
      return 0;
    }

    let changed = 0;

    const cards =
      Array.from(
        root.querySelectorAll(
          [
            'article',
            '[class*="metric"]',
            '[class*="kpi"]',
            '[class*="summary-card"]',
          ].join(','),
        ),
      );

    payload.summary
      .forEach(
        (metric) => {
          const metricLabel =
            normalizeText(
              metric?.label
              ?? metric?.key
              ?? '',
            );

          if (!metricLabel) {
            return;
          }

          const card =
            cards.find(
              (candidate) => {
                const text =
                  normalizeText(
                    candidate.textContent,
                  );

                return (
                  text.includes(
                    metricLabel,
                  )
                  && visible(
                    candidate,
                  )
                );
              },
            );

          if (!card) {
            return;
          }

          const values =
            Array.from(
              card.querySelectorAll(
                'strong, [class*="value"], [data-value]',
              ),
            );

          const target =
            values.find(
              (candidate) =>
                looksLikeValue(
                  candidate.textContent,
                ),
            );

          if (!target) {
            return;
          }

          const formatted =
            valueFormat(
              metric?.value,
              metric?.format
              ?? metric?.type
              ?? 'number',
            );

          if (
            setText(
              target,
              formatted,
            )
          ) {
            changed++;
          }
        },
      );

    return changed;
  }

  function rowObjectValue(
    row,
    keys,
  ) {
    for (
      const key of keys
    ) {
      const value =
        row?.[key];

      if (
        value !== null
        && value !== undefined
        && String(value).trim()
      ) {
        return value;
      }
    }

    return null;
  }

  function focusRowInfo(
    row,
  ) {
    const primary =
      rowObjectValue(
        row,
        [
          'sale_number',
          'receivable_number',
          'invoice_number',
          'reference_number',
          'reference',
          'journal_number',
          'supplier_name',
          'exception_type',
          'type',
          'name',
          'code',
          'id',
        ],
      );

    const secondary =
      rowObjectValue(
        row,
        [
          'customer_name',
          'supplier_name',
          'business_date',
          'due_date',
          'sold_at',
          'received_at',
          'source',
          'sale_type',
        ],
      );

    const status =
      rowObjectValue(
        row,
        [
          'payment_status',
          'status',
          'reconciliation_status',
          'severity',
          'state',
        ],
      );

    const amount =
      rowObjectValue(
        row,
        [
          'balance_amount',
          'outstanding_amount',
          'outstanding',
          'variance_amount',
          'amount',
          'total_amount',
          'paid_amount',
        ],
      );

    return {
      primary:
        primary != null
          ? String(primary)
          : 'Finance record',
      secondary:
        secondary != null
          ? String(secondary)
          : 'Current Finance data',
      status:
        status != null
          ? String(status)
          : 'Current',
      amount:
        amount != null
          ? money(amount)
          : 'RWF 0',
    };
  }

  function writeFocusRow(
    node,
    info,
  ) {
    const firstStrong =
      node.querySelector(
        'span strong',
      );

    const firstSmall =
      node.querySelector(
        'span small',
      );

    const children =
      Array.from(
        node.children,
      );

    setText(
      firstStrong,
      info.primary,
    );

    setText(
      firstSmall,
      info.secondary,
    );

    setText(
      children[1],
      info.status,
    );

    setText(
      children[2],
      info.amount,
    );
  }

  function bindFocusRegister(
    root,
    payload,
  ) {
    if (!root) {
      return false;
    }

    const container =
      root.querySelector(
        '.focus-register-table',
      );

    if (!container) {
      return false;
    }

    const rows =
      payload.rows
        .slice(
          0,
          15,
        );

    const template =
      container
        .firstElementChild;

    if (!template) {
      return false;
    }

    const desired =
      rows.length > 0
        ? rows.map(
          focusRowInfo,
        )
        : [
          {
            primary:
              'No qualifying records',
            secondary:
              'No records are currently returned by this Finance source.',
            status:
              'Current',
            amount:
              'RWF 0',
          },
        ];

    const signature =
      desired
        .map(
          (item) =>
            [
              item.primary,
              item.secondary,
              item.status,
              item.amount,
            ].join('|'),
        )
        .join('||');

    if (
      container.dataset
        .aquilaFinanceSignature
      === signature
      && container.children.length
        === desired.length
    ) {
      return true;
    }

    const nodes =
      desired.map(
        (info) => {
          const clone =
            template.cloneNode(
              true,
            );

          writeFocusRow(
            clone,
            info,
          );

          return clone;
        },
      );

    container.replaceChildren(
      ...nodes,
    );

    container.dataset
      .aquilaFinanceSignature =
        signature;

    return true;
  }

  function tbodyPlaceholder(
    tbody,
  ) {
    if (!tbody) {
      return false;
    }

    if (
      tbody.children.length
      === 0
    ) {
      return true;
    }

    const text =
      normalizeText(
        tbody.textContent,
      );

    return (
      text === ''
      || text.includes(
        'no data',
      )
      || text.includes(
        'no records',
      )
      || text.includes(
        'no receivables',
      )
      || text.includes(
        'loading',
      )
      || text === '—'
    );
  }

  function bindOperationalReceivables(
    root,
    payload,
  ) {
    if (!root) {
      return false;
    }

    const table =
      root.querySelector(
        '.receivables-table',
      );

    const tbody =
      table?.querySelector(
        'tbody',
      );

    if (
      !table
      || !tbody
      || !tbodyPlaceholder(
        tbody,
      )
    ) {
      return false;
    }

    if (
      payload.rows.length
      === 0
    ) {
      return false;
    }

    const desired =
      payload.rows
        .slice(
          0,
          20,
        );

    const signature =
      desired
        .map(
          (row) =>
            [
              row?.sale_number,
              row?.balance_amount,
              row?.payment_status,
            ].join('|'),
        )
        .join('||');

    if (
      tbody.dataset
        .aquilaFinanceSignature
      === signature
    ) {
      return true;
    }

    const fragment =
      document.createDocumentFragment();

    desired.forEach(
      (row) => {
        const tr =
          document.createElement(
            'tr',
          );

        const values = [
          row?.sale_number
            ?? `Sale #${row?.id ?? ''}`,

          row?.customer_name
            ?? 'Operational sale',

          (
            'Operational exposure'
            + (
              row?.payment_status
                ? ` · ${row.payment_status}`
                : ''
            )
          ),

          money(
            row?.balance_amount
            ?? 0,
          ),

          row?.due_date
            ?? 'Not formalised',

          '—',
        ];

        values.forEach(
          (value) => {
            const td =
              document.createElement(
                'td',
              );

            td.textContent =
              String(value);

            tr.appendChild(td);
          },
        );

        fragment.appendChild(
          tr,
        );
      },
    );

    tbody.replaceChildren(
      fragment,
    );

    tbody.dataset
      .aquilaFinanceSignature =
        signature;

    return true;
  }

  function normalizedColumn(
    value,
  ) {
    return normalizeText(
      value,
    ).replace(/\s/g, '');
  }

  function genericTableFallback(
    root,
    payload,
  ) {
    if (
      !root
      || payload.rows.length
        === 0
      || payload.columns.length
        < 2
    ) {
      return false;
    }

    const tables =
      Array.from(
        root.querySelectorAll(
          'table',
        ),
      );

    for (
      const table of tables
    ) {
      const tbody =
        table.querySelector(
          'tbody',
        );

      if (
        !tbody
        || !tbodyPlaceholder(
          tbody,
        )
      ) {
        continue;
      }

      const headers =
        Array.from(
          table.querySelectorAll(
            'thead th',
          ),
        );

      if (
        headers.length
        < 2
      ) {
        continue;
      }

      const mappings =
        headers.map(
          (header) => {
            const headerName =
              normalizedColumn(
                header.textContent,
              );

            let best = null;

            for (
              const column
              of payload.columns
            ) {
              const candidates = [
                column?.key,
                column?.label,
              ]
                .map(
                  normalizedColumn,
                )
                .filter(Boolean);

              if (
                candidates.some(
                  (candidate) =>
                    candidate
                      === headerName
                    || candidate.includes(
                      headerName,
                    )
                    || headerName.includes(
                      candidate,
                    ),
                )
              ) {
                best =
                  column;

                break;
              }
            }

            return best;
          },
        );

      const matched =
        mappings.filter(
          Boolean,
        ).length;

      if (matched < 2) {
        continue;
      }

      const signature =
        payload.rows
          .slice(
            0,
            25,
          )
          .map(
            (row) =>
              String(
                row?.id
                ?? row?.sale_number
                ?? row?.reference_number
                ?? '',
              ),
          )
          .join('|');

      if (
        tbody.dataset
          .aquilaFinanceSignature
        === signature
      ) {
        return true;
      }

      const fragment =
        document.createDocumentFragment();

      payload.rows
        .slice(
          0,
          25,
        )
        .forEach(
          (row) => {
            const tr =
              document.createElement(
                'tr',
              );

            mappings.forEach(
              (column) => {
                const td =
                  document.createElement(
                    'td',
                  );

                if (!column) {
                  td.textContent =
                    '—';
                } else {
                  td.textContent =
                    valueFormat(
                      row?.[
                        column.key
                      ],
                      column.type
                      ?? 'text',
                    );
                }

                tr.appendChild(
                  td,
                );
              },
            );

            fragment.appendChild(
              tr,
            );
          },
        );

      tbody.replaceChildren(
        fragment,
      );

      tbody.dataset
        .aquilaFinanceSignature =
          signature;

      return true;
    }

    return false;
  }

  function accountBalance(
    row,
  ) {
    const debit =
      number(
        row?.debit,
      );

    const credit =
      number(
        row?.credit,
      );

    const type =
      normalizeText(
        row?.account_type,
      );

    if (type === 'income') {
      return credit - debit;
    }

    if (type === 'expense') {
      return debit - credit;
    }

    return number(
      row?.balance
      ?? 0,
    );
  }

  function pnlComputed(
    payload,
  ) {
    const byName =
      new Map();

    const byCode =
      new Map();

    const incomeRows = [];
    const expenseRows = [];

    let income = 0;
    let expenses = 0;

    payload.rows
      .forEach(
        (row) => {
          const balance =
            accountBalance(
              row,
            );

          const enriched = {
            row,
            balance,
          };

          const name =
            normalizeText(
              row?.name,
            );

          const code =
            String(
              row?.code
              ?? '',
            ).trim();

          if (name) {
            byName.set(
              name,
              enriched,
            );
          }

          if (code) {
            byCode.set(
              code,
              enriched,
            );
          }

          const type =
            normalizeText(
              row?.account_type,
            );

          if (
            type === 'income'
          ) {
            income +=
              balance;

            incomeRows.push(
              enriched,
            );
          }

          if (
            type === 'expense'
          ) {
            expenses +=
              balance;

            expenseRows.push(
              enriched,
            );
          }
        },
      );

    const net =
      income
      - expenses;

    const margin =
      Math.abs(income) > 0.00001
        ? (
          net
          / income
          * 100
        )
        : 0;

    return {
      income,
      expenses,
      net,
      margin,
      byName,
      byCode,
      incomeRows,
      expenseRows,
    };
  }

  function lookupAccount(
    computed,
    label,
  ) {
    const normalized =
      normalizeText(
        label,
      );

    if (
      computed.byName.has(
        normalized,
      )
    ) {
      return computed
        .byName
        .get(
          normalized,
        )
        .balance;
    }

    return null;
  }

  function pnlStatementValue(
    label,
    computed,
  ) {
    const normalized =
      normalizeText(
        label,
      );

    const direct =
      lookupAccount(
        computed,
        label,
      );

    if (direct !== null) {
      return {
        value: direct,
        type: 'money',
      };
    }

    const salesRevenue =
      computed.byCode
        .get('4000')
        ?.balance
      ?? 0;

    const salesReturns =
      computed.byCode
        .get('4010')
        ?.balance
      ?? 0;

    const cogs =
      computed.byCode
        .get('5000')
        ?.balance
      ?? 0;

    const operatingExpenses =
      computed.byCode
        .get('6000')
        ?.balance
      ?? 0;

    const supplierExpense =
      computed.byCode
        .get('6100')
        ?.balance
      ?? 0;

    const insuranceWriteOff =
      computed.byCode
        .get('7000')
        ?.balance
      ?? 0;

    const otherIncome =
      computed.incomeRows
        .filter(
          (item) => {
            const code =
              String(
                item.row?.code
                ?? '',
              );

            return (
              code !== '4000'
              && code !== '4010'
            );
          },
        )
        .reduce(
          (
            total,
            item,
          ) =>
            total
            + item.balance,
          0,
        );

    if (
      normalized.includes(
        'sales revenue',
      )
      || normalized
        === 'sales'
    ) {
      return {
        value:
          salesRevenue,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'sales returns',
      )
    ) {
      return {
        value:
          salesReturns,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'other income',
      )
    ) {
      return {
        value:
          otherIncome,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'total income',
      )
      || normalized.includes(
        'total revenue',
      )
    ) {
      return {
        value:
          computed.income,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'cost of goods sold',
      )
      || normalized
        === 'cogs'
    ) {
      return {
        value:
          cogs,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'gross profit',
      )
    ) {
      return {
        value:
          computed.income
          - cogs,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'operating expenses',
      )
    ) {
      return {
        value:
          operatingExpenses,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'supplier expense',
      )
    ) {
      return {
        value:
          supplierExpense,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'insurance write',
      )
    ) {
      return {
        value:
          insuranceWriteOff,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'total expenses',
      )
    ) {
      return {
        value:
          computed.expenses,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'operating profit',
      )
      || normalized.includes(
        'net profit',
      )
      || normalized.includes(
        'net income',
      )
    ) {
      return {
        value:
          computed.net,
        type:
          'money',
      };
    }

    if (
      normalized.includes(
        'profit margin',
      )
    ) {
      return {
        value:
          computed.margin,
        type:
          'percent',
      };
    }

    return {
      value: 0,
      type: 'money',
    };
  }

  function changePercent(
    current,
    previous,
  ) {
    const currentValue =
      number(current);

    const previousValue =
      number(previous);

    if (
      Math.abs(
        previousValue,
      ) < 0.00001
    ) {
      if (
        Math.abs(
          currentValue,
        ) < 0.00001
      ) {
        return 0;
      }

      return null;
    }

    return (
      (
        currentValue
        - previousValue
      )
      / Math.abs(
        previousValue,
      )
      * 100
    );
  }

  function setComparisonCells(
    row,
    current,
    previous,
    type = 'money',
  ) {
    const cells =
      Array.from(
        row.querySelectorAll(
          'td',
        ),
      );

    if (
      cells.length < 2
    ) {
      return;
    }

    const formatter =
      type === 'percent'
        ? percent
        : money;

    setText(
      cells[1],
      formatter(
        current,
      ),
    );

    if (
      cells.length >= 3
    ) {
      setText(
        cells[2],
        formatter(
          previous,
        ),
      );
    }

    if (
      cells.length >= 4
    ) {
      setText(
        cells[3],
        formatter(
          number(current)
          - number(previous),
        ),
      );
    }

    if (
      cells.length >= 5
    ) {
      const change =
        changePercent(
          current,
          previous,
        );

      setText(
        cells[4],
        change === null
          ? '—'
          : percent(
            change,
          ),
      );
    }
  }

  function seriesValues(
    payload,
  ) {
    return payload.series
      .map(
        (point) => {
          const primary =
            number(
              point?.primary
              ?? point?.primary_value
              ?? point?.income
              ?? point?.inflow
              ?? point?.net
              ?? point?.net_cash_flow
              ?? point?.value
              ?? 0,
            );

          const secondary =
            number(
              point?.secondary
              ?? point?.secondary_value
              ?? point?.expenses
              ?? point?.outflow
              ?? point?.payments
              ?? 0,
            );

          return {
            primary,
            secondary,
          };
        },
      );
  }

  function chartPrepare(
    shell,
    renderKey,
  ) {
    if (!shell) {
      return null;
    }

    const existing =
      shell.querySelector(
        '[data-aquila-finance-series]',
      );

    if (
      shell.dataset
        .aquilaFinanceRenderKey
        === renderKey
      && existing
    ) {
      return null;
    }

    const svg =
      shell.querySelector(
        'svg',
      );

    if (!svg) {
      return null;
    }

    svg.querySelectorAll(
      '[data-aquila-finance-series]',
    ).forEach(
      (node) =>
        node.remove(),
    );

    svg.setAttribute(
      'viewBox',
      '0 0 1000 260',
    );

    shell.dataset
      .aquilaFinanceRenderKey =
        renderKey;

    return svg;
  }

  function chartFinish(
    shell,
    hasData,
  ) {
    const emptyLabel =
      shell?.querySelector(
        ':scope > span',
      )
      ?? shell?.querySelector(
        'span',
      );

    if (emptyLabel) {
      emptyLabel.hidden =
        Boolean(hasData);
    }
  }

  function renderLines(
  shell,
  series,
  renderKey
) {
  const active =
    series.filter(
      values =>
        Array.isArray(values)
        &&
        values.length > 0
    );

  if(
    !shell
    ||
    active.length === 0
  ){
    chartFinish(
      shell,
      false
    );

    return false;
  }

  const svg =
    chartPrepare(
      shell,
      renderKey
    );

  if(!svg){
    chartFinish(
      shell,
      true
    );

    return true;
  }

  const all =
    active
      .flat()
      .map(
        value =>
          number(value)
      );

  let minimum =
    Math.min(
      0,
      ...all
    );

  let maximum =
    Math.max(
      0,
      ...all
    );

  if(
    Math.abs(
      maximum-minimum
    )
    <
    0.00001
  ){
    maximum =
      minimum+1;
  }

  const colors=[
    "#18a35c",
    "#df4b4b",
    "#2b6fd3"
  ];

  const ns=
    "http://www.w3.org/2000/svg";

  const formatValue =
    value => {
      if(!Number.isFinite(value)){
        return "";
      }

      const abs =
        Math.abs(value);

      const compact =
        (scale,suffix) => {
          const scaled =
            Math.round(
              value/scale*10
            )/10;

          return (
            Number.isInteger(scaled)
              ? String(scaled)
              : scaled.toFixed(1)
          )+suffix;
        };

      if(abs>=1000000000){
        return compact(
          1000000000,
          "B"
        );
      }

      if(abs>=1000000){
        return compact(
          1000000,
          "M"
        );
      }

      if(abs>=1000){
        return compact(
          1000,
          "K"
        );
      }

      const rounded =
        Math.round(
          value*10
        )/10;

      return Number.isInteger(rounded)
        ? String(rounded)
        : rounded.toFixed(1);
    };

  active.forEach(
    (
      values,
      seriesIndex
    ) => {
      const xAt =
        index =>
          values.length===1
            ? 500
            : (
                60+
                (
                  index/
                  (
                    values.length-1
                  )
                  *
                  880
                )
              );

      const yAt =
        rawValue => {
          const value =
            number(rawValue);

          const ratio =
            (
              value-minimum
            )
            /
            (
              maximum-minimum
            );

          return (
            220-
            (
              ratio*180
            )
          );
        };

      const points =
        values
          .map(
            (
              value,
              index
            ) =>
              (
                xAt(index)
                  .toFixed(2)
                +
                ","
                +
                yAt(value)
                  .toFixed(2)
              )
          )
          .join(" ");

      const polyline =
        document
          .createElementNS(
            ns,
            "polyline"
          );

      polyline.setAttribute(
        "data-aquila-finance-series",
        String(seriesIndex)
      );

      polyline.setAttribute(
        "points",
        points
      );

      polyline.setAttribute(
        "fill",
        "none"
      );

      polyline.setAttribute(
        "stroke",
        colors[
          seriesIndex
          %
          colors.length
        ]
      );

      polyline.setAttribute(
        "stroke-width",
        "5"
      );

      polyline.setAttribute(
        "stroke-linecap",
        "round"
      );

      polyline.setAttribute(
        "stroke-linejoin",
        "round"
      );

      svg.appendChild(
        polyline
      );

      const allZero =
        values.every(
          raw =>
            Math.abs(
              number(raw)
            )
            <
            0.000001
        );

      values.forEach(
        (
          rawValue,
          index
        ) => {
          /*
           * One zero label is sufficient for a completely-zero
           * line.  Genuine non-zero points all receive labels.
           */
          if(
            allZero
            &&
            index
            !==
            values.length-1
          ){
            return;
          }

          const value =
            number(rawValue);

          const label =
            formatValue(value);

          if(!label){
            return;
          }

          const text =
            document
              .createElementNS(
                ns,
                "text"
              );

          text.setAttribute(
            "x",
            String(
              xAt(index)
            )
          );

          text.setAttribute(
            "y",
            String(
              Math.max(
                18,
                yAt(value)
                -
                13
                -
                seriesIndex*17
              )
            )
          );

          text.setAttribute(
            "text-anchor",
            "middle"
          );

          text.setAttribute(
            "class",
            "aquila-finance-r22-direct-label"
          );

          text.setAttribute(
            "data-aquila-finance-r22-value",
            String(value)
          );

          text.textContent =
            label;

          svg.appendChild(
            text
          );
        }
      );
    }
  );

  chartFinish(
    shell,
    true
  );

  return true;
}

  function renderBars(
  shell,
  values,
  renderKey
) {
  if(
    !shell
    ||
    !Array.isArray(values)
    ||
    values.length===0
  ){
    chartFinish(
      shell,
      false
    );

    return false;
  }

  const svg =
    chartPrepare(
      shell,
      renderKey
    );

  if(!svg){
    chartFinish(
      shell,
      true
    );

    return true;
  }

  const maximum =
    Math.max(
      1,
      ...values.map(
        value =>
          Math.abs(
            number(value)
          )
      )
    );

  const colors=[
    "#18a35c",
    "#df4b4b",
    "#2b6fd3"
  ];

  const ns=
    "http://www.w3.org/2000/svg";

  const barWidth =
    values.length<=2
      ? 220
      : 160;

  const gap=90;

  const totalWidth =
    (
      values.length*
      barWidth
    )
    +
    (
      (
        values.length-1
      )
      *
      gap
    );

  const startX =
    (
      1000-totalWidth
    )/2;

  const formatValue =
    value => {
      if(!Number.isFinite(value)){
        return "";
      }

      const abs =
        Math.abs(value);

      const compact =
        (scale,suffix) => {
          const scaled =
            Math.round(
              value/scale*10
            )/10;

          return (
            Number.isInteger(scaled)
              ? String(scaled)
              : scaled.toFixed(1)
          )+suffix;
        };

      if(abs>=1000000000){
        return compact(
          1000000000,
          "B"
        );
      }

      if(abs>=1000000){
        return compact(
          1000000,
          "M"
        );
      }

      if(abs>=1000){
        return compact(
          1000,
          "K"
        );
      }

      const rounded =
        Math.round(
          value*10
        )/10;

      return Number.isInteger(rounded)
        ? String(rounded)
        : rounded.toFixed(1);
    };

  values.forEach(
    (
      rawValue,
      index
    ) => {
      const signedValue =
        number(rawValue);

      const value =
        Math.abs(
          signedValue
        );

      const height =
        value/
        maximum*
        175;

      const x =
        startX+
        (
          index*
          (
            barWidth+gap
          )
        );

      const y =
        220-height;

      const rect =
        document
          .createElementNS(
            ns,
            "rect"
          );

      rect.setAttribute(
        "data-aquila-finance-series",
        String(index)
      );

      rect.setAttribute(
        "x",
        String(x)
      );

      rect.setAttribute(
        "y",
        String(y)
      );

      rect.setAttribute(
        "width",
        String(barWidth)
      );

      rect.setAttribute(
        "height",
        String(
          Math.max(
            height,
            1
          )
        )
      );

      rect.setAttribute(
        "rx",
        "8"
      );

      rect.setAttribute(
        "fill",
        colors[
          index
          %
          colors.length
        ]
      );

      svg.appendChild(
        rect
      );

      const label =
        formatValue(
          signedValue
        );

      if(label){
        const text =
          document
            .createElementNS(
              ns,
              "text"
            );

        text.setAttribute(
          "x",
          String(
            x+
            barWidth/2
          )
        );

        text.setAttribute(
          "y",
          String(
            Math.max(
              18,
              y-12
            )
          )
        );

        text.setAttribute(
          "text-anchor",
          "middle"
        );

        text.setAttribute(
          "class",
          "aquila-finance-r22-direct-label"
        );

        text.setAttribute(
          "data-aquila-finance-r22-value",
          String(
            signedValue
          )
        );

        text.textContent =
          label;

        svg.appendChild(
          text
        );
      }
    }
  );

  chartFinish(
    shell,
    true
  );

  return true;
}

  function bindPnl(
    root,
    pair,
  ) {
    const current =
      pnlComputed(
        pair.current,
      );

    const comparison =
      pnlComputed(
        pair.comparison,
      );

    const metricCards =
      Array.from(
        root.querySelectorAll(
          '.profit-loss-v1__metric',
        ),
      );

    const metricValues = {
      'total income':
        current.income,
      'total expenses':
        current.expenses,
      'net profit':
        current.net,
      'profit margin':
        current.margin,
    };

    metricCards.forEach(
      (card) => {
        const label =
          normalizeText(
            card.querySelector(
              'header span, span',
            )?.textContent,
          );

        const strong =
          card.querySelector(
            'strong',
          );

        if (
          !(label in metricValues)
          || !strong
        ) {
          return;
        }

        setText(
          strong,
          label
            === 'profit margin'
            ? percent(
              metricValues[
                label
              ],
            )
            : money(
              metricValues[
                label
              ],
            ),
        );
      },
    );

    const tbody =
      root.querySelector(
        '.profit-loss-v1__statement tbody',
      )
      ?? root.querySelector(
        'table tbody',
      );

    if (tbody) {
      Array.from(
        tbody.querySelectorAll(
          'tr',
        ),
      ).forEach(
        (row) => {
          const cells =
            Array.from(
              row.querySelectorAll(
                'td',
              ),
            );

          if (
            cells.length < 2
            || (
              cells[0]
              && cells[0].colSpan > 1
            )
            || row.className
              .includes(
                'section-row',
              )
          ) {
            return;
          }

          const label =
            cells[0]
              ?.textContent
            ?? '';

          const currentValue =
            pnlStatementValue(
              label,
              current,
            );

          const comparisonValue =
            pnlStatementValue(
              label,
              comparison,
            );

          setComparisonCells(
            row,
            currentValue.value,
            comparisonValue.value,
            currentValue.type,
          );
        },
      );
    }

    const charts =
      Array.from(
        root.querySelectorAll(
          '.profit-loss-v1__empty-chart',
        ),
      );

    const currentSeries =
      seriesValues(
        pair.current,
      );

    if (
      charts[0]
      && currentSeries.length > 0
    ) {
      renderLines(
        charts[0],
        [
          currentSeries.map(
            (point) =>
              point.primary,
          ),
          currentSeries.map(
            (point) =>
              point.secondary,
          ),
        ],
        (
          'pnl-income-expense|'
          + pair.periods.from
          + '|'
          + pair.periods.to
          + '|'
          + currentSeries.length
        ),
      );
    } else if (charts[0]) {
      renderBars(
        charts[0],
        [
          current.income,
          current.expenses,
        ],
        (
          'pnl-income-expense-bars|'
          + pair.periods.from
          + '|'
          + pair.periods.to
          + '|'
          + current.income
          + '|'
          + current.expenses
        ),
      );
    }

    if (
      charts[1]
      && currentSeries.length > 0
    ) {
      renderLines(
        charts[1],
        [
          currentSeries.map(
            (point) =>
              point.primary
              - point.secondary,
          ),
        ],
        (
          'pnl-net|'
          + pair.periods.from
          + '|'
          + pair.periods.to
          + '|'
          + currentSeries.length
        ),
      );
    } else if (charts[1]) {
      renderBars(
        charts[1],
        [
          comparison.net,
          current.net,
        ],
        (
          'pnl-net-bars|'
          + comparison.net
          + '|'
          + current.net
        ),
      );
    }

    return ((__aqV)=>{window.__AQUILA_FINANCE_NATIVE_DATA_R1__.publish("financial-statements",{pair:pair,values:__aqV,series:currentSeries});return __aqV;})({
      current_income:
        current.income,
      current_expenses:
        current.expenses,
      current_net:
        current.net,
      current_margin:
        current.margin,
      comparison_income:
        comparison.income,
      comparison_expenses:
        comparison.expenses,
      comparison_net:
        comparison.net,
    });
  }

  function cashComputed(
    payload,
  ) {
    /*
     * AQUILA_QB2_3B_R2_CASH_FLOW_BINDING
     */

    const legacyBalance =
      metricNumber(
        payload,
        'cash_balance',
        'Cash / Bank / MoMo balance',
      );

    const debits =
      metricNumber(
        payload,
        'cash_debits',
        'Liquid-account debits',
      );

    const credits =
      metricNumber(
        payload,
        'cash_credits',
        'Liquid-account credits',
      );

    const payments =
      metricNumber(
        payload,
        'payments',
        'Customer payment movement',
      );

    const sales =
      metricNumber(
        payload,
        'sales',
        'Sales movement',
      );

    const hasOpening =
      Boolean(
        metricByKey(
          payload,
          'opening_balance',
          'Opening balance',
        ),
      );

    const hasClosing =
      Boolean(
        metricByKey(
          payload,
          'closing_balance',
          'Closing balance',
        ),
      );

    const hasNet =
      Boolean(
        metricByKey(
          payload,
          'net_cash_change',
          'Net cash change',
        ),
      );

    const legacyNet =
      debits
      - credits;

    const closing =
      hasClosing
        ? metricNumber(
            payload,
            'closing_balance',
            'Closing balance',
          )
        : legacyBalance;

    const net =
      hasNet
        ? metricNumber(
            payload,
            'net_cash_change',
            'Net cash change',
          )
        : legacyNet;

    const opening =
      hasOpening
        ? metricNumber(
            payload,
            'opening_balance',
            'Opening balance',
          )
        : closing - net;

    return {
      balance:
        closing,

      legacyBalance,

      debits,
      credits,
      payments,
      sales,
      net,
      opening,

      operating:
        metricNumber(
          payload,
          'operating_activities',
          'Net cash from operating activities',
        ),

      investing:
        metricNumber(
          payload,
          'investing_activities',
          'Net cash from investing activities',
        ),

      financing:
        metricNumber(
          payload,
          'financing_activities',
          'Net cash from financing activities',
        ),

      unclassified:
        metricNumber(
          payload,
          'unclassified_cash_movement',
          'Unclassified cash movement',
        ),

      statementDifference:
        metricNumber(
          payload,
          'statement_difference',
          'Cash Flow statement difference',
        ),
    };
  }

  function cashStatementValue(
    label,
    computed,
  ) {
    const normalized =
      normalizeText(
        label,
      );

    if (
      normalized.includes(
        'opening balance',
      )
      ||
      normalized.includes(
        'opening cash',
      )
    ) {
      return computed.opening;
    }

    if (
      normalized.includes(
        'closing balance',
      )
      ||
      normalized.includes(
        'closing cash',
      )
    ) {
      return computed.balance;
    }

    /*
     * Specific activity totals MUST be checked before
     * the generic "net cash" matcher.
     */
    if (
      normalized.includes(
        'net cash from operating',
      )
      ||
      normalized.includes(
        'net cash provided by operating',
      )
      ||
      normalized.includes(
        'net cash used in operating',
      )
    ) {
      return computed.operating;
    }

    if (
      normalized.includes(
        'net cash from investing',
      )
      ||
      normalized.includes(
        'net cash provided by investing',
      )
      ||
      normalized.includes(
        'net cash used in investing',
      )
    ) {
      return computed.investing;
    }

    if (
      normalized.includes(
        'net cash from financing',
      )
      ||
      normalized.includes(
        'net cash provided by financing',
      )
      ||
      normalized.includes(
        'net cash used in financing',
      )
    ) {
      return computed.financing;
    }

    if (
      normalized.includes(
        'customer payment',
      )
      ||
      normalized.includes(
        'cash receipt',
      )
      ||
      normalized.includes(
        'receipts from customer',
      )
    ) {
      return computed.payments;
    }

    if (
      normalized.includes(
        'sales movement',
      )
    ) {
      return computed.sales;
    }

    if (
      normalized.includes(
        'cash inflow',
      )
      ||
      normalized === 'inflow'
    ) {
      return computed.debits;
    }

    if (
      normalized.includes(
        'cash outflow',
      )
      ||
      normalized === 'outflow'
    ) {
      return computed.credits;
    }

    if (
      normalized.includes(
        'net cash',
      )
      ||
      normalized.includes(
        'net movement',
      )
      ||
      normalized.includes(
        'net increase',
      )
      ||
      normalized.includes(
        'net decrease',
      )
    ) {
      return computed.net;
    }

    /*
     * Detailed unsupported rows remain zero.
     * No synthetic classification is invented.
     */
    return 0;
  }

  

  /*
   * AQUILA_QB2_3C_CASH_FLOW_HISTORY
   *
   * Historical table extension and chart value labels.
   * The canonical bindCashFlow() remains the only Cash Flow renderer.
   */

  const AQ_CASH_FLOW_FIRST_MONTH =
    "2026-01";

  let aqCashFlowHistoryRun = 0;

  function aqMonthStart(
    year,
    monthIndex,
  ) {
    return (
      String(year)
      + '-'
      + String(
          monthIndex + 1,
        ).padStart(
          2,
          '0',
        )
      + '-01'
    );
  }

  function aqMonthEnd(
    year,
    monthIndex,
  ) {
    const last =
      new Date(
        Date.UTC(
          year,
          monthIndex + 1,
          0,
        ),
      );

    return (
      String(
        last.getUTCFullYear(),
      )
      + '-'
      + String(
          last.getUTCMonth() + 1,
        ).padStart(
          2,
          '0',
        )
      + '-'
      + String(
          last.getUTCDate(),
        ).padStart(
          2,
          '0',
        )
    );
  }

  function aqMonthKey(
    year,
    monthIndex,
  ) {
    return (
      String(year)
      + '-'
      + String(
          monthIndex + 1,
        ).padStart(
          2,
          '0',
        )
    );
  }

  function aqPreviousMonth(
    year,
    monthIndex,
  ) {
    if (monthIndex === 0) {
      return {
        year:
          year - 1,
        monthIndex: 11,
      };
    }

    return {
      year,
      monthIndex:
        monthIndex - 1,
    };
  }

  function aqMonthLabel(
    year,
    monthIndex,
  ) {
    return new Intl.DateTimeFormat(
      undefined,
      {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      },
    ).format(
      new Date(
        Date.UTC(
          year,
          monthIndex,
          1,
        ),
      ),
    );
  }

  function aqParseDateOnly(
    value,
  ) {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/
        .exec(
          String(
            value
            ?? '',
          ),
        );

    if (!match) {
      return null;
    }

    return {
      year:
        Number(
          match[1],
        ),

      monthIndex:
        Number(
          match[2],
        ) - 1,

      day:
        Number(
          match[3],
        ),
    };
  }

  function aqCashHistoryMonths(
    currentFrom,
  ) {
    const current =
      aqParseDateOnly(
        currentFrom,
      );

    const first =
      /^(\d{4})-(\d{2})$/
        .exec(
          AQ_CASH_FLOW_FIRST_MONTH,
        );

    if (
      !current
      ||
      !first
    ) {
      return [];
    }

    const firstYear =
      Number(
        first[1],
      );

    const firstMonthIndex =
      Number(
        first[2],
      ) - 1;

    const months = [];

    let cursor =
      aqPreviousMonth(
        current.year,
        current.monthIndex,
      );

    /*
     * Previous Month already exists in the standard comparison
     * column. Historical extension therefore begins at the
     * previous-previous month.
     */
    cursor =
      aqPreviousMonth(
        cursor.year,
        cursor.monthIndex,
      );

    while (
      cursor.year > firstYear
      ||
      (
        cursor.year === firstYear
        &&
        cursor.monthIndex >=
          firstMonthIndex
      )
    ) {
      months.push(
        {
          year:
            cursor.year,

          monthIndex:
            cursor.monthIndex,

          key:
            aqMonthKey(
              cursor.year,
              cursor.monthIndex,
            ),

          label:
            aqMonthLabel(
              cursor.year,
              cursor.monthIndex,
            ),

          from:
            aqMonthStart(
              cursor.year,
              cursor.monthIndex,
            ),

          to:
            aqMonthEnd(
              cursor.year,
              cursor.monthIndex,
            ),
        },
      );

      cursor =
        aqPreviousMonth(
          cursor.year,
          cursor.monthIndex,
        );
    }

    return months;
  }

  function aqHistoricalValue(
    label,
    payload,
  ) {
    return cashStatementValue(
      label,
      cashComputed(
        payload,
      ),
    );
  }

  function aqCreateCell(
    tagName,
    className,
    text,
  ) {
    const cell =
      document.createElement(
        tagName,
      );

    cell.className =
      className;

    cell.textContent =
      text;

    return cell;
  }

  function aqFormatHistoricalMoney(
    value,
  ) {
    return money(
      number(
        value,
      ),
    );
  }

  async function aqLoadCashHistory(
    months,
    runId,
  ) {
    /*
     * Sequential requests intentionally avoid a burst against
     * the existing canonical Cash Flow endpoint.
     */
    const result = [];

    for (
      const month
      of months
    ) {
      if (
        runId
        !== aqCashFlowHistoryRun
      ) {
        return [];
      }

      const payload =
        await fetchModule(
          'cash-flow',
          {
            from:
              month.from,

            to:
              month.to,

            page: 1,
            per_page: 200,
          },
        );

      result.push(
        {
          month,
          payload,
        },
      );
    }

    return result;
  }

  function aqEnsureCashFlowScroller(
    table,
  ) {
    const parent =
      table.parentElement;

    if (
      parent
      &&
      parent.classList.contains(
        'aq-cash-flow-scroll',
      )
    ) {
      return parent;
    }

    const wrapper =
      document.createElement(
        'div',
      );

    wrapper.className =
      'aq-cash-flow-scroll';

    table.parentNode.insertBefore(
      wrapper,
      table,
    );

    wrapper.appendChild(
      table,
    );

    return wrapper;
  }

  function aqApplyCashFlowHeaderContract(
    table,
    pair,
  ) {
    /*
     * AQUILA_QB2_3C2_R1_MONTH_HEADERS_AND_CHART_LABELS
     */

    const headerRow =
      table.querySelector(
        'thead tr',
      );

    if (!headerRow) {
      return;
    }

    const headers =
      Array.from(
        headerRow.children,
      );

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const monthNameFromDate =
      (value) => {
        const parsed =
          aqParseDateOnly(
            value,
          );

        if (!parsed) {
          return '';
        }

        return (
          monthNames[
            parsed.monthIndex
          ]
          + ' '
          + parsed.year
        );
      };

    const monthNameFromText =
      (value) => {
        const text =
          String(
            value
            ?? '',
          ).trim();

        const match =
          /\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+(\d{4})\b/i.exec(
            text,
          );

        if (!match) {
          return '';
        }

        const key =
          match[1]
            .slice(
              0,
              3,
            )
            .toLowerCase();

        const index = {
          jan: 0,
          feb: 1,
          mar: 2,
          apr: 3,
          may: 4,
          jun: 5,
          jul: 6,
          aug: 7,
          sep: 8,
          oct: 9,
          nov: 10,
          dec: 11,
        }[key];

        if (
          index === undefined
        ) {
          return '';
        }

        return (
          monthNames[index]
          + ' '
          + match[2]
        );
      };

    const sourceHeaderText =
      (header) => {
        if (!header) {
          return '';
        }

        const currentText =
          String(
            header.textContent
            ?? '',
          ).trim();

        /*
         * Native binder normally restores the actual period range
         * before this enhancement runs.
         *
         * When it does, refresh the stored source period.
         */
        if (
          /\d{4}/.test(
            currentText,
          )
          &&
          (
            currentText.includes(
              '–',
            )
            ||
            currentText.includes(
              '-',
            )
          )
        ) {
          header.dataset
            .aqSourcePeriod =
              currentText;
        }

        return (
          header.dataset
            .aqSourcePeriod
          ||
          currentText
        );
      };

    const currentMonth =
      monthNameFromDate(
        pair?.periods?.from,
      )
      ||
      monthNameFromText(
        sourceHeaderText(
          headers[1],
        ),
      )
      ||
      'Current Period';

    const previousDate =
      pair?.periods?.comparisonFrom
      ??
      pair?.periods?.compareFrom
      ??
      pair?.periods?.previousFrom
      ??
      pair?.comparison?.periods?.from
      ??
      null;

    const previousMonth =
      monthNameFromDate(
        previousDate,
      )
      ||
      monthNameFromText(
        sourceHeaderText(
          headers[2],
        ),
      )
      ||
      'Previous Period';

    const labels = [
      'Particulars',
      currentMonth,
      previousMonth,
      'Change',
      '% Change',
    ];

    const roles = [
      'particulars',
      'current',
      'previous',
      'change',
      'change-percent',
    ];

    labels.forEach(
      (
        label,
        index,
      ) => {
        const header =
          headers[index];

        if (!header) {
          return;
        }

        header.textContent =
          label;

        /*
         * dataset.aqCashColumn creates:
         *
         * data-aq-cash-column
         *
         * in the live DOM.
         */
        header.dataset
          .aqCashColumn =
            roles[index];

        header.classList.toggle(
          'aq-cash-flow-particulars',
          index === 0,
        );

        header.classList.toggle(
          'aq-cash-flow-number',
          index > 0,
        );
      },
    );

    table
      .querySelectorAll(
        'tbody tr',
      )
      .forEach(
        (row) => {
          Array.from(
            row.children,
          )
            .slice(
              0,
              5,
            )
            .forEach(
              (
                cell,
                index,
              ) => {
                cell.dataset
                  .aqCashColumn =
                    roles[index];

                if (index > 0) {
                  cell.classList.add(
                    'aq-cash-flow-number',
                  );
                }
              },
            );
        },
      );
  }

  function aqRemoveHistoricalColumns(
    table,
  ) {
    table
      .querySelectorAll(
        '[data-aq-cash-history="1"]',
      )
      .forEach(
        (node) => {
          node.remove();
        },
      );
  }

  function aqAppendHistoricalColumns(
    table,
    history,
  ) {
    aqRemoveHistoricalColumns(
      table,
    );

    const headerRow =
      table.querySelector(
        'thead tr',
      );

    if (!headerRow) {
      return;
    }

    history.forEach(
      (
        item,
        index,
      ) => {
        const header =
          aqCreateCell(
            'th',
            'aq-cash-flow-history-head aq-cash-flow-number',
            item.month.label,
          );

        header.dataset
          .aqCashHistory =
            '1';

        header.dataset
          .month =
            item.month.key;

        if (index === 0) {
          header.classList.add(
            'aq-cash-flow-history-first',
          );
        }

        headerRow.appendChild(
          header,
        );
      },
    );

    const bodyRows =
      Array.from(
        table.querySelectorAll(
          'tbody tr',
        ),
      );

    bodyRows.forEach(
      (row) => {
        /*
         * Section rows span the full table width instead of showing
         * meaningless month cells.
         */
        const cells =
          Array.from(
            row.children,
          );

        const firstCell =
          cells[0];

        if (!firstCell) {
          return;
        }

        const label =
          normalizeText(
            firstCell.textContent,
          );

        const isSection =
          row.classList.contains(
            'section',
          )
          ||
          row.classList.contains(
            'group',
          )
          ||
          (
            cells.length === 1
            &&
            firstCell.tagName
              .toLowerCase()
              === 'th'
          )
          ||
          [
            'operating activities',
            'investing activities',
            'financing activities',
          ].includes(
            label,
          );

        if (isSection) {
          const originalSpan =
            Number(
              firstCell.dataset
                .aqOriginalColspan
              ??
              firstCell.getAttribute(
                'colspan',
              )
              ??
              5,
            );

          if (
            !firstCell.dataset
              .aqOriginalColspan
          ) {
            firstCell.dataset
              .aqOriginalColspan =
                String(
                  originalSpan,
                );
          }

          firstCell.setAttribute(
            'colspan',
            String(
              originalSpan
              +
              history.length,
            ),
          );

          return;
        }

        history.forEach(
          (item) => {
            const cell =
              aqCreateCell(
                'td',
                'aq-cash-flow-history-cell aq-cash-flow-number',
                aqFormatHistoricalMoney(
                  aqHistoricalValue(
                    firstCell.textContent,
                    item.payload,
                  ),
                ),
              );

            cell.dataset
              .aqCashHistory =
                '1';

            cell.dataset
              .month =
                item.month.key;

            row.appendChild(
              cell,
            );
          },
        );
      },
    );
  }

  function aqRightAlignCashFlow(
    root,
  ) {
    root
      .querySelectorAll(
        '.cash-flow-v1__metric strong',
      )
      .forEach(
        (node) => {
          node.classList.add(
            'aq-cash-flow-number',
          );
        },
      );

    const table =
      root.querySelector(
        '.cash-flow-v1__statement table',
      )
      ??
      root.querySelector(
        'table',
      );

    if (!table) {
      return;
    }

    table
      .querySelectorAll(
        'thead tr > *',
      )
      .forEach(
        (
          cell,
          index,
        ) => {
          cell.classList.toggle(
            'aq-cash-flow-particulars',
            index === 0,
          );

          cell.classList.toggle(
            'aq-cash-flow-number',
            index > 0,
          );
        },
      );

    table
      .querySelectorAll(
        'tbody tr',
      )
      .forEach(
        (row) => {
          Array.from(
            row.children,
          )
            .forEach(
              (
                cell,
                index,
              ) => {
                if (index > 0) {
                  cell.classList.add(
                    'aq-cash-flow-number',
                  );
                }
              },
            );
        },
      );
  }

  /*
   * AQUILA_QB2_3C2_R1_MONTH_HEADERS_AND_CHART_LABELS
   *
   * Automatic chart data labels.
   *
   * HTML overlays are used so the implementation works regardless
   * of whether Finance renders the underlying graph with SVG or Canvas.
   */

  function aqRemoveCashChartLabels(
    root,
  ) {
    root
      .querySelectorAll(
        '.aq-cash-chart-label-overlay, .aq-cash-chart-svg-label-layer',
      )
      .forEach(
        (node) => {
          node.remove();
        },
      );
  }

  function aqCompactCashLabel(
    value,
  ) {
    const amount =
      number(
        value,
      );

    const absolute =
      Math.abs(
        amount,
      );

    if (
      absolute
      >= 1000000000
    ) {
      return (
        (
          amount
          / 1000000000
        ).toFixed(1)
        + 'B'
      );
    }

    if (
      absolute
      >= 1000000
    ) {
      return (
        (
          amount
          / 1000000
        ).toFixed(1)
        + 'M'
      );
    }

    if (
      absolute
      >= 1000
    ) {
      return (
        (
          amount
          / 1000
        ).toFixed(1)
        + 'K'
      );
    }

    return new Intl.NumberFormat(
      undefined,
      {
        maximumFractionDigits: 0,
      },
    ).format(
      amount,
    );
  }

  function aqCashChartPanelByTitle(
    root,
    title,
  ) {
    const expected =
      normalizeText(
        title,
      );

    const headings =
      Array.from(
        root.querySelectorAll(
          'h1, h2, h3, h4, h5, strong',
        ),
      );

    const heading =
      headings.find(
        (node) =>
          normalizeText(
            node.textContent,
          )
          === expected,
      );

    if (!heading) {
      return null;
    }

    let candidate =
      heading.parentElement;

    while (
      candidate
      &&
      candidate !== root
    ) {
      if (
        candidate.querySelector(
          'svg, canvas',
        )
      ) {
        return candidate;
      }

      candidate =
        candidate.parentElement;
    }

    return heading.closest(
      'section, article, figure, div',
    );
  }

  function aqCashChartSurface(
    panel,
  ) {
    if (!panel) {
      return null;
    }

    const surfaces =
      Array.from(
        panel.querySelectorAll(
          'svg, canvas',
        ),
      ).filter(
        (node) => {
          const rect =
            node.getBoundingClientRect();

          return (
            rect.width > 120
            &&
            rect.height > 80
          );
        },
      );

    if (
      surfaces.length === 0
    ) {
      return null;
    }

    return surfaces.sort(
      (
        left,
        right,
      ) => {
        const leftRect =
          left.getBoundingClientRect();

        const rightRect =
          right.getBoundingClientRect();

        return (
          (
            rightRect.width
            *
            rightRect.height
          )
          -
          (
            leftRect.width
            *
            leftRect.height
          )
        );
      },
    )[0];
  }

  function aqCashCurrentSeries(
    pair,
  ) {
    return Array.isArray(
      pair?.current?.series,
    )
      ? pair.current.series
      : [];
  }

  function aqCashChartSeries(
    pair,
    chartType,
  ) {
    const source =
      aqCashCurrentSeries(
        pair,
      );

    if (
      source.length === 0
    ) {
      return [];
    }

    if (
      chartType === 'in-out'
    ) {
      return [
        {
          key: 'inflow',

          values:
            source.map(
              (point) =>
                number(
                  point.primary
                  ??
                  point.inflow
                  ??
                  point.debit
                  ??
                  0,
                ),
            ),
        },

        {
          key: 'outflow',

          values:
            source.map(
              (point) =>
                number(
                  point.secondary
                  ??
                  point.outflow
                  ??
                  point.credit
                  ??
                  0,
                ),
            ),
        },
      ];
    }

    return [
      {
        key: 'net',

        values:
          source.map(
            (point) => {
              const primary =
                number(
                  point.primary
                  ??
                  point.inflow
                  ??
                  point.debit
                  ??
                  0,
                );

              const secondary =
                number(
                  point.secondary
                  ??
                  point.outflow
                  ??
                  point.credit
                  ??
                  0,
                );

              return (
                primary
                -
                secondary
              );
            },
          ),
      },
    ];
  }

  function aqCashShouldLabel(
    value,
  ) {
    return (
      Number.isFinite(
        value,
      )
      &&
      Math.abs(
        value,
      ) >= 0.005
    );
  }

  function aqRenderCashChartOverlay(
    panel,
    series,
  ) {
    if (
      !panel
      ||
      series.length === 0
    ) {
      return 0;
    }

    const surface =
      aqCashChartSurface(
        panel,
      );

    if (!surface) {
      return 0;
    }

    panel.classList.add(
      'aq-cash-chart-label-host',
    );

    panel
      .querySelectorAll(
        '.aq-cash-chart-label-overlay',
      )
      .forEach(
        (node) => {
          node.remove();
        },
      );

    const panelRect =
      panel.getBoundingClientRect();

    const surfaceRect =
      surface.getBoundingClientRect();

    if (
      surfaceRect.width <= 0
      ||
      surfaceRect.height <= 0
    ) {
      return 0;
    }

    const overlay =
      document.createElement(
        'div',
      );

    overlay.className =
      'aq-cash-chart-label-overlay';

    overlay.setAttribute(
      'aria-hidden',
      'true',
    );

    overlay.style.left =
      (
        surfaceRect.left
        -
        panelRect.left
      )
      + 'px';

    overlay.style.top =
      (
        surfaceRect.top
        -
        panelRect.top
      )
      + 'px';

    overlay.style.width =
      surfaceRect.width
      + 'px';

    overlay.style.height =
      surfaceRect.height
      + 'px';

    panel.appendChild(
      overlay,
    );

    const allValues =
      series.flatMap(
        (item) =>
          item.values
            .map(
              (value) =>
                number(
                  value,
                ),
            )
            .filter(
              (value) =>
                Number.isFinite(
                  value,
                ),
            ),
      );

    if (
      allValues.length === 0
    ) {
      return 0;
    }

    let minimum =
      Math.min(
        0,
        ...allValues,
      );

    let maximum =
      Math.max(
        0,
        ...allValues,
      );

    if (
      Math.abs(
        maximum
        -
        minimum,
      ) < 0.0001
    ) {
      minimum -= 1;
      maximum += 1;
    }

    const range =
      maximum
      -
      minimum;

    let rendered = 0;

    series.forEach(
      (
        item,
        seriesIndex,
      ) => {
        const values =
          item.values;

        const count =
          values.length;

        values.forEach(
          (
            rawValue,
            pointIndex,
          ) => {
            const value =
              number(
                rawValue,
              );

            if (
              !aqCashShouldLabel(
                value,
              )
            ) {
              return;
            }

            const xRatio =
              count <= 1
                ? 0.5
                : (
                    pointIndex
                    /
                    (
                      count - 1
                    )
                  );

            const yRatio =
              (
                maximum
                -
                value
              )
              /
              range;

            /*
             * Reserve chart edge space for axes/ticks.
             */
            const x =
              7
              +
              (
                xRatio
                * 86
              );

            const y =
              9
              +
              (
                yRatio
                * 78
              )
              +
              (
                seriesIndex
                * 2.8
              );

            const label =
              document.createElement(
                'span',
              );

            label.className =
              (
                'aq-cash-chart-data-label '
                +
                'aq-cash-chart-data-label--'
                +
                item.key
              );

            label.textContent =
              aqCompactCashLabel(
                value,
              );

            label.style.left =
              x + '%';

            label.style.top =
              y + '%';

            overlay.appendChild(
              label,
            );

            rendered += 1;
          },
        );
      },
    );

    return rendered;
  }

  function aqRenderCashChartLabelsNow(
    root,
    pair,
  ) {
    aqRemoveCashChartLabels(
      root,
    );

    const inOutPanel =
      aqCashChartPanelByTitle(
        root,
        'Cash Inflow vs Cash Outflow',
      );

    const netPanel =
      aqCashChartPanelByTitle(
        root,
        'Net Cash Flow Trend',
      );

    const inOutCount =
      aqRenderCashChartOverlay(
        inOutPanel,
        aqCashChartSeries(
          pair,
          'in-out',
        ),
      );

    const netCount =
      aqRenderCashChartOverlay(
        netPanel,
        aqCashChartSeries(
          pair,
          'net',
        ),
      );

    root.dataset
      .aqCashInOutLabels =
        String(
          inOutCount,
        );

    root.dataset
      .aqCashNetLabels =
        String(
          netCount,
        );

    root.dataset
      .aqCashChartLabels =
        String(
          inOutCount
          +
          netCount,
        );
  }

  function aqLabelCashCharts(
    root,
    pair,
  ) {
    const render =
      () => {
        if (
          !root
          ||
          !root.isConnected
        ) {
          return;
        }

        aqRenderCashChartLabelsNow(
          root,
          pair,
        );
      };

    /*
     * Native Finance chart rendering may complete after bindCashFlow().
     * A bounded post-render sequence covers both SVG and Canvas rendering.
     */
    requestAnimationFrame(
      () => {
        requestAnimationFrame(
          render,
        );
      },
    );

    window.setTimeout(
      render,
      180,
    );

    window.setTimeout(
      render,
      520,
    );
  }

  async function enhanceCashFlowHistory(
    root,
    pair,
  ) {
    if (
      !root
      ||
      !root.classList.contains(
        'cash-flow-v1',
      )
    ) {
      return;
    }

    const table =
      root.querySelector(
        '.cash-flow-v1__statement table',
      )
      ??
      root.querySelector(
        'table',
      );

    if (!table) {
      aqRightAlignCashFlow(
        root,
      );

      aqLabelCashCharts(
        root,
        pair,
      );

      return;
    }

    aqEnsureCashFlowScroller(
      table,
    );

    aqApplyCashFlowHeaderContract(
      table,
      pair,
    );

    aqRightAlignCashFlow(
      root,
    );

    aqLabelCashCharts(
      root,
      pair,
    );

    const months =
      aqCashHistoryMonths(
        pair.periods.from,
      );

    const runId =
      ++aqCashFlowHistoryRun;

    table.setAttribute(
      'aria-busy',
      months.length > 0
        ? 'true'
        : 'false',
    );

    if (months.length === 0) {
      aqRemoveHistoricalColumns(
        table,
      );

      table.setAttribute(
        'aria-busy',
        'false',
      );

      return;
    }

    const history =
      await aqLoadCashHistory(
        months,
        runId,
      );

    if (
      runId
      !== aqCashFlowHistoryRun
    ) {
      return;
    }

    aqAppendHistoricalColumns(
      table,
      history,
    );

    aqRightAlignCashFlow(
      root,
    );

    table.setAttribute(
      'aria-busy',
      'false',
    );
  }

function bindCashFlow(
    root,
    pair,
  ) {
    const current =
      cashComputed(
        pair.current,
      );

    const comparison =
      cashComputed(
        pair.comparison,
      );

    /*
     * AQUILA_QB2_3C1_EXECUTION_FIX
     *
     * Execute the already-existing QB2.3C enhancement from the
     * live bindCashFlow path, before the binder can return.
     */
    void enhanceCashFlowHistory(
      root,
      pair,
    ).catch(
      (error) => {
        console.error(
          '[Aquila] Cash Flow history enhancement failed.',
          error,
        );
      },
    );


    const cards =
      Array.from(
        root.querySelectorAll(
          '.cash-flow-v1__metric',
        ),
      );

    const values = {
      'cash inflow':
        current.debits,
      'cash outflow':
        current.credits,
      'net cash flow':
        current.net,
      'closing balance':
        current.balance,
    };

    cards.forEach(
      (card) => {
        const label =
          normalizeText(
            card.querySelector(
              'header span, span',
            )?.textContent,
          );

        const strong =
          card.querySelector(
            'strong',
          );

        if (
          !(label in values)
          || !strong
        ) {
          return;
        }

        setText(
          strong,
          money(
            values[label],
          ),
        );
      },
    );

    const tbody =
      root.querySelector(
        '.cash-flow-v1__statement tbody',
      )
      ?? root.querySelector(
        'table tbody',
      );

    if (tbody) {
      Array.from(
        tbody.querySelectorAll(
          'tr',
        ),
      ).forEach(
        (row) => {
          const cells =
            Array.from(
              row.querySelectorAll(
                'td',
              ),
            );

          if (
            cells.length < 2
            || (
              cells[0]
              && cells[0].colSpan > 1
            )
            || row.className
              .includes(
                'section-row',
              )
          ) {
            return;
          }

          const label =
            cells[0]
              ?.textContent
            ?? '';

          const currentValue =
            cashStatementValue(
              label,
              current,
            );

          const comparisonValue =
            cashStatementValue(
              label,
              comparison,
            );

          setComparisonCells(
            row,
            currentValue,
            comparisonValue,
            'money',
          );
        },
      );
    }

    const charts =
      Array.from(
        root.querySelectorAll(
          '.cash-flow-v1__empty-chart',
        ),
      );

    if (charts[0]) {
      /*
       * This chart is a period-total comparison using real
       * liquid-account debit and credit aggregates. It does not
       * mislabel customer payments as ledger outflow.
       */
      renderBars(
        charts[0],
        [
          current.debits,
          current.credits,
        ],
        (
          'cash-in-out|'
          + pair.periods.from
          + '|'
          + pair.periods.to
          + '|'
          + current.debits
          + '|'
          + current.credits
        ),
      );
    }

    const currentSeries =
      seriesValues(
        pair.current,
      );

    if (
      charts[1]
      && currentSeries.length > 0
    ) {
      renderLines(
        charts[1],
        [
          currentSeries.map(
            (point) =>
              point.primary,
          ),
        ],
        (
          'cash-net-trend|'
          + pair.periods.from
          + '|'
          + pair.periods.to
          + '|'
          + currentSeries.length
        ),
      );
    } else if (charts[1]) {
      renderBars(
        charts[1],
        [
          comparison.net,
          current.net,
        ],
        (
          'cash-net-bars|'
          + comparison.net
          + '|'
          + current.net
        ),
      );
    }

    return ((__aqV)=>{window.__AQUILA_FINANCE_NATIVE_DATA_R1__.publish("cash-flow",{pair:pair,values:__aqV,series:currentSeries});return __aqV;})({
      current_inflow:
        current.debits,
      current_outflow:
        current.credits,
      current_net:
        current.net,
      current_closing:
        current.balance,
      current_payments:
        current.payments,
      current_sales:
        current.sales,
      comparison_net:
        comparison.net,
    });
  

    
}

  async function backgroundProbeAll() { return Promise.resolve(undefined); }

  let applying = false;

  async function applyCurrent(
    reason = 'runtime',
  ) {
    if (
      applying
      || !isFinanceRoute()
    ) {
      return;
    }

    const state =
      routeState();

    const moduleKey =
      modules[
        state.finance
      ]
        ? state.finance
        : 'overview';

    diagnostics.active_module =
      moduleKey;

    const root =
      rootForModule(
        moduleKey,
      );

    if (!root) {
      diagnostics.last_binding = {
        module:
          moduleKey,
        status:
          'waiting-for-existing-ui',
        reason,
        at:
          new Date()
            .toISOString(),
      };

      return;
    }

    applying = true;

    try {
      if (
        moduleKey
        === 'financial-statements'
      ) {
        const pair =
          await fetchPeriodPair(
            moduleKey,
            root,
          );

        const values =
          bindPnl(
            root,
            pair,
          );

        diagnostics.last_binding = {
          module:
            moduleKey,
          status:
            'existing-pnl-ui-bound',
          values,
          periods:
            pair.periods,
          reason,
          at:
            new Date()
              .toISOString(),
        };

        return;
      }

      if (
        moduleKey
        === 'cash-flow'
      ) {
        const pair =
          await fetchPeriodPair(
            moduleKey,
            root,
          );

        const values =
          bindCashFlow(
            root,
            pair,
          );

        diagnostics.last_binding = {
          module:
            moduleKey,
          status:
            'existing-cash-flow-ui-bound',
          values,
          periods:
            pair.periods,
          reason,
          at:
            new Date()
              .toISOString(),
        };

        return;
      }

      const payload =
        await fetchModule(
          moduleKey,
          {
            page: 1,
            per_page: 100,
          },
        );

      if (
        moduleKey
        === 'accounting'
      ) {
        diagnostics.last_binding = {
          module:
            moduleKey,
          status:
            'native-accounting-ui-preserved-api-healthy',
          reason,
          at:
            new Date()
              .toISOString(),
        };

        return;
      }

      let binding =
        'native-ui-preserved';

      if (
        moduleKey
          === 'overview'
        || moduleKey
          === 'exception-focus'
        || moduleKey
          === 'receivable-register'
        || moduleKey
          === 'collection'
      ) {
        if (
          bindFocusRegister(
            root,
            payload,
          )
        ) {
          binding =
            'existing-focus-register-bound';
        }
      }

      if (
        moduleKey
        === 'credits-receivables'
      ) {
        if (
          bindOperationalReceivables(
            root,
            payload,
          )
        ) {
          binding =
            'existing-receivables-table-bound-to-operational-exposure';
        }
      }

      const summaryChanges =
        bindGenericSummary(
          root,
          payload,
        );

      const tableFallback =
        genericTableFallback(
          root,
          payload,
        );

      if (
        tableFallback
        && binding
          === 'native-ui-preserved'
      ) {
        binding =
          'existing-empty-table-bound';
      }

      diagnostics.last_binding = {
        module:
          moduleKey,
        status:
          binding,
        summary_values_updated:
          summaryChanges,
        rows:
          payload.rows.length,
        reason,
        at:
          new Date()
            .toISOString(),
      };
    } catch (error) {
      diagnostics.errors.push({
        module:
          moduleKey,
        reason,
        message:
          error instanceof Error
            ? error.message
            : String(error),
        at:
          new Date()
            .toISOString(),
      });

      diagnostics.last_binding = {
        module:
          moduleKey,
        status:
          'binding-error',
        message:
          error instanceof Error
            ? error.message
            : String(error),
        reason,
        at:
          new Date()
            .toISOString(),
      };
    } finally {
      applying = false;
    }
  }

  let timer = null;

  function schedule(
    reason,
    delay = 180,
  ) {
    window.clearTimeout(
      timer,
    );

    timer =
      window.setTimeout(
        () => {
          void applyCurrent(
            reason,
          );
        },
        delay,
      );
  }

  function settledBindingPasses(
    reason,
  ) {
    [
      40,
      220,
      650,
      1400,
    ].forEach(
      (delay) => {
        window.setTimeout(
          () => {
            if (
              isFinanceRoute()
            ) {
              void applyCurrent(
                reason
                + ':'
                + delay,
              );
            }
          },
          delay,
        );
      },
    );
  }

  function refreshData(
    reason,
  ) {
    cache.clear();

    settledBindingPasses(
      reason,
    );
  }

  window.addEventListener(
    'hashchange',
    () => {
      settledBindingPasses(
        'hashchange',
      );
    },
  );

  document.addEventListener(
    'change',
    (event) => {
      const target =
        event.target;

      if (
        !(target instanceof Element)
      ) {
        return;
      }

      if (
        target.matches(
          '.profit-loss-v1 input[type="date"], .profit-loss-v1 select, .cash-flow-v1 input[type="date"], .cash-flow-v1 select',
        )
      ) {
        refreshData(
          'finance-filter-change',
        );
      }
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      const target =
        event.target;

      if (
        !(target instanceof Element)
      ) {
        return;
      }

      const button =
        target.closest(
          'button',
        );

      if (!button) {
        return;
      }

      const label =
        normalizeText(
          button.textContent,
        );

      if (
        (
          label.includes(
            'refresh',
          )
          || label.includes(
            'apply',
          )
          || label.includes(
            'filter',
          )
          || label.includes(
            'update',
          )
        )
        && (
          button.closest(
            '.profit-loss-v1',
          )
          || button.closest(
            '.cash-flow-v1',
          )
        )
      ) {
        window.setTimeout(
          () => {
            refreshData(
              'finance-filter-button',
            );
          },
          60,
        );
      }
    },
    true,
  );
  window.__AQUILA_FINANCE_EXISTING_UI_APPLY_R2_4__ =
    (reason = 'runtime') => applyCurrent(reason);


  function start() {
    /*
     * R1.1 stability rule:
     * Do not observe the complete React DOM.
     *
     * The R1 binder itself changes table cells, charts and text.
     * A subtree-wide MutationObserver therefore observed its own
     * writes and continuously scheduled another binding pass.
     *
     * Instead, use a small bounded set of post-navigation passes.
     * This gives the existing React workspace enough time to mount
     * without creating a render feedback loop.
     */
    if (
      isFinanceRoute()
    ) {
      settledBindingPasses(
        'initial',
      );
    }
  }

  if (
    document.readyState
    === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      {
        once: true,
      },
    );
  } else {
    start();
  }


/* ============================================================
   AQUILA R2.9.9 — EXPOSE EXISTING GENUINE R1 BINDER
   ============================================================ */

function __aquilaR299CurrentModule(){
  try{
    const current=
      routeState();

    return (
      modules[
        current.finance
      ]
        ? current.finance
        : 'overview'
    );
  }catch(_error){
    return '';
  }
}

window.__AQUILA_FINANCE_LIVE_DATA_R1__={
  release:
    RELEASE,

  currentModule:
    __aquilaR299CurrentModule,

  rootReady:
    function(){
      const moduleKey=
        __aquilaR299CurrentModule();

      if(
        !moduleKey
      ){
        return false;
      }

      return !!rootForModule(
        moduleKey
      );
    },

  applyActiveModule:
    async function(reason){
  /* AQUILA_FINANCE_BINDING_CONTRACT_R2_9_11 */

  const current=
    routeState();

  const moduleKey=
    current &&
    current.finance
      ? current.finance
      : 'overview';

  diagnostics.active_module=
    moduleKey;

  function at(){
    return new Date()
      .toISOString();
  }

  function binding(){
    return (
      diagnostics.last_binding &&
      typeof diagnostics.last_binding==='object'
    )
      ? diagnostics.last_binding
      : null;
  }

  function valid(
    candidate,
    expectedModule
  ){
    if(
      !candidate ||
      candidate.module!==expectedModule
    ){
      return false;
    }

    const status=
      String(
        candidate.status ||
        ''
      );

    if(!status){
      return false;
    }

    return !(
      /waiting|error|failed|unavailable/i
        .test(status)
    );
  }

  function retry(
    status,
    extra
  ){
    diagnostics.last_binding=
      Object.assign(
        {
          module:
            moduleKey,

          status:
            status,

          reason:
            reason ||
            'r2.9.11-binding-contract',

          at:
            at()
        },

        extra ||
        {}
      );

    return false;
  }

  function success(
    owner,
    status,
    finalBinding,
    extra
  ){
    return Object.assign(
      {
        ok:
          true,

        module:
          moduleKey,

        owner:
          owner,

        status:
          status,

        binding:
          finalBinding ||
          null,

        reason:
          reason ||
          'r2.9.11-binding-contract',

        at:
          at()
      },

      extra ||
      {}
    );
  }

  function failure(
    owner,
    error
  ){
    const message=
      error &&
      error.message
        ? error.message
        : String(error);

    if(
      Array.isArray(
        diagnostics.errors
      )
    ){
      diagnostics.errors.push({
        module:
          moduleKey,

        owner:
          owner,

        reason:
          reason ||
          'r2.9.11-binding-contract',

        message:
          message,

        at:
          at()
      });
    }

    diagnostics.last_binding={
      module:
        moduleKey,

      owner:
        owner,

      status:
        'binding-error',

      reason:
        reason ||
        'r2.9.11-binding-contract',

      message:
        message,

      at:
        at()
    };

    return false;
  }

  function visibleTitle(label){
    const wanted=
      String(
        label ||
        ''
      )
        .replace(
          /\s+/g,
          ' '
        )
        .trim();

    const nodes=
      document.querySelectorAll(
        'h1,h2,h3,h4,h5,h6,' +
        '[role="heading"],' +
        '.card-title,' +
        '.section-title,' +
        'div,span,p'
      );

    for(
      let index=0;
      index<nodes.length;
      index+=1
    ){
      const node=
        nodes[index];

      const actual=
        String(
          node.textContent ||
          ''
        )
          .replace(
            /\s+/g,
            ' '
          )
          .trim();

      if(
        actual!==wanted
      ){
        continue;
      }

      const style=
        getComputedStyle(
          node
        );

      const rect=
        node
          .getBoundingClientRect();

      if(
        style.display!=='none' &&
        style.visibility!=='hidden' &&
        rect.width>0 &&
        rect.height>0
      ){
        return true;
      }
    }

    return false;
  }

  /*
   * OVERVIEW
   */
  if(
    moduleKey==='overview'
  ){
    const owner=
      window
        .__AQUILA_FINANCE_OVERVIEW_R2_9_10__;

    if(
      !owner ||
      typeof owner.apply!=='function'
    ){
      return retry(
        'waiting-for-specialized-overview-owner',
        {
          owner:
            'existing-loadOverview'
        }
      );
    }

    if(
      typeof owner.rootReady==='function' &&
      !owner.rootReady()
    ){
      return retry(
        'waiting-for-specialized-overview-root',
        {
          owner:
            'existing-loadOverview'
        }
      );
    }

    try{
      const result=
        await owner.apply();

      if(
        result===false
      ){
        return retry(
          'waiting-for-specialized-overview-binding',
          {
            owner:
              'existing-loadOverview'
          }
        );
      }

      const presenter=
        window
          .__AQUILA_FINANCE_R2_9_1__;

      if(
        presenter &&
        typeof presenter.apply==='function'
      ){
        const presented=
          presenter.apply();

        const resolved=
          presented &&
          typeof presented.then==='function'
            ? await presented
            : presented;

        if(
          resolved===false
        ){
          return retry(
            'waiting-for-overview-presentation',
            {
              owner:
                'existing-R2.9.1-presentation'
            }
          );
        }
      }

      if(
        !visibleTitle(
          'Revenue vs Expenses Trend'
        ) ||
        !visibleTitle(
          'Cash Flow Overview'
        )
      ){
        return retry(
          'waiting-for-overview-approved-ui',
          {
            owner:
              'existing-loadOverview'
          }
        );
      }

      const finalBinding={
        module:
          moduleKey,

        status:
          'specialized-overview-bound',

        owner:
          'existing-loadOverview',

        reason:
          reason ||
          'r2.9.11-binding-contract',

        at:
          at()
      };

      diagnostics.last_binding=
        finalBinding;

      return success(
        'existing-loadOverview',
        finalBinding.status,
        finalBinding,
        {
          ownerResult:
            result===undefined
              ? null
              : result
        }
      );

    }catch(error){

      return failure(
        'existing-loadOverview',
        error
      );
    }
  }

  /*
   * PROFIT & LOSS
   */
  if(
    moduleKey==='financial-statements'
  ){
    const before=
      binding();

    try{
      await applyCurrent(
        reason ||
        'r2.9.11-binding-contract'
      );

      const after=
        binding();

      if(
        after===before ||
        !valid(
          after,
          moduleKey
        )
      ){
        return false;
      }

      return success(
        'existing-bindPnl',
        after.status,
        after
      );

    }catch(error){

      return failure(
        'existing-bindPnl',
        error
      );
    }
  }

  /*
   * CASH FLOW
   */
  if(
    moduleKey==='cash-flow'
  ){
    const before=
      binding();

    try{
      await applyCurrent(
        reason ||
        'r2.9.11-binding-contract'
      );

      const after=
        binding();

      if(
        after===before ||
        !valid(
          after,
          moduleKey
        )
      ){
        return false;
      }

      return success(
        'existing-bindCashFlow',
        after.status,
        after
      );

    }catch(error){

      return failure(
        'existing-bindCashFlow',
        error
      );
    }
  }

  /*
   * SALES
   */
  if(
    moduleKey==='sales'
  ){
    const before=
      binding();

    let baseBinding=null;

    try{
      await applyCurrent(
        reason ||
        'r2.9.11-binding-contract'
      );

      baseBinding=
        binding();

      if(
        baseBinding===before ||
        !valid(
          baseBinding,
          moduleKey
        )
      ){
        return retry(
          'waiting-for-sales-base-binding',
          {
            owner:
              'existing-R1-sales-binding'
          }
        );
      }

    }catch(error){

      return failure(
        'existing-R1-sales-binding',
        error
      );
    }

    const owner=
      window
        .__AQUILA_FINANCE_R2_9_1__;

    if(
      !owner ||
      typeof owner.apply!=='function'
    ){
      return retry(
        'waiting-for-specialized-sales-owner',
        {
          owner:
            'existing-R2.9.1-applySales',

          base_binding:
            baseBinding
        }
      );
    }

    try{
      const result=
        owner.apply();

      const resolved=
        result &&
        typeof result.then==='function'
          ? await result
          : result;

      if(
        resolved===false
      ){
        return retry(
          'waiting-for-specialized-sales-binding',
          {
            owner:
              'existing-R2.9.1-applySales',

            base_binding:
              baseBinding
          }
        );
      }

      if(
        !visibleTitle(
          'Sales vs Returns'
        ) ||
        !visibleTitle(
          'Revenue Trend'
        )
      ){
        return retry(
          'waiting-for-sales-approved-ui',
          {
            owner:
              'existing-R2.9.1-applySales',

            base_binding:
              baseBinding
          }
        );
      }

      const finalBinding={
        module:
          moduleKey,

        status:
          'specialized-sales-bound',

        owner:
          'existing-R2.9.1-applySales',

        base_binding:
          baseBinding,

        sales_returns_source:
          'genuine-refund-return-map-only',

        paid_amount_used_as_return:
          false,

        reason:
          reason ||
          'r2.9.11-binding-contract',

        at:
          at()
      };

      diagnostics.last_binding=
        finalBinding;

      return success(
        'existing-R2.9.1-applySales',
        finalBinding.status,
        finalBinding,
        {
          ownerResult:
            resolved===undefined
              ? null
              : resolved,

          salesReturnsSource:
            'genuine-refund-return-map-only',

          paidAmountUsedAsReturn:
            false
        }
      );

    }catch(error){

      return failure(
        'existing-R2.9.1-applySales',
        error
      );
    }
  }

  /*
   * OTHER FINANCE MODULES
   */
  {
    const before=
      binding();

    try{
      await applyCurrent(
        reason ||
        'r2.9.11-binding-contract'
      );

      const after=
        binding();

      if(
        after===before ||
        !valid(
          after,
          moduleKey
        )
      ){
        return false;
      }

      return success(
        'existing-applyCurrent',
        after.status,
        after
      );

    }catch(error){

      return failure(
        'existing-applyCurrent',
        error
      );
    }
  }
},

  diagnose:
    function(){
      return {
        release:
          RELEASE,

        active_module:
          diagnostics.active_module,

        requested_module:
          __aquilaR299CurrentModule(),

        last_binding:
          diagnostics.last_binding,

        source_health:
          diagnostics.source_health,

        cache_entries:
          cache.size,

        errors:
          Array.isArray(
            diagnostics.errors
          )
            ? diagnostics.errors.slice(
                -8
              )
            : []
      };
    }
,
invalidateCache:function(){cache.clear();return true;},
};

})();

(function () {
  'use strict';

  if (window.__AQUILA_FINANCE_RUNTIME_LIFECYCLE_R2_4_INSTALLED__) return;

  const waits = []; /* R2.8 owns Finance scheduling. */

  let generation = 0;
  let runs = 0;
  let lastError = null;
  let lastAppliedAt = null;

  function state() {
    const p = new URLSearchParams(location.hash.replace(/^#/, ''));

    return {
      section: p.get('section'),
      workspace: p.get('finance') || 'overview',
    };
  }

  function isFinance() {
    return state().section === 'finance';
  }

  async function apply(reason) {
    if (!isFinance()) return false;

    runs += 1;

    try {
      if (state().workspace === 'overview') {
        const fn = window.__AQUILA_FINANCE_OVERVIEW_APPLY_R2_4__;

        if (typeof fn !== 'function') {
          throw new Error('overview bridge not ready');
        }

        await fn();
      } else {
        const fn = window.__AQUILA_FINANCE_EXISTING_UI_APPLY_R2_4__;

        if (typeof fn !== 'function') {
          throw new Error('finance bridge not ready');
        }

        await fn(reason);
      }

      lastError = null;
      lastAppliedAt = new Date().toISOString();

      return true;
    } catch (error) {
      lastError = String(error?.message ?? error);

      return false;
    }
  }

  function schedule(reason) {
    const current = ++generation;

    waits.forEach((delay) => {
      setTimeout(() => {
        if (current !== generation || !isFinance()) return;

        void apply(reason + ':' + delay);
      }, delay);
    });
  }

  addEventListener(
    'hashchange',
    () => schedule('hashchange'),
    { passive: true },
  );

  addEventListener(
    'pageshow',
    () => schedule('pageshow'),
    { passive: true },
  );

  addEventListener(
    'focus',
    () => {
      if (isFinance()) schedule('focus');
    },
    { passive: true },
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        document.visibilityState === 'visible'
        && isFinance()
      ) {
        schedule('visible');
      }
    },
    { passive: true },
  );

  document.addEventListener(
    'change',
    () => {
      if (isFinance()) schedule('change');
    },
    { passive: true },
  );

  document.addEventListener(
    'click',
    (event) => {
      if (!isFinance()) return;

      const target =
        event.target instanceof Element
          ? event.target
          : null;

      if (
        target?.closest(
          'button,a,[role="button"]',
        )
      ) {
        schedule('click');
      }
    },
    { passive: true },
  );

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        if (isFinance()) schedule('dom-ready');
      },
      { once: true },
    );
  } else if (isFinance()) {
    schedule('immediate');
  }

  window.__AQUILA_FINANCE_RUNTIME_LIFECYCLE_R2_4__ = {
    diagnostics() {
      return {
        route: state(),
        runs,
        last_error: lastError,
        last_applied_at: lastAppliedAt,

        overview:
          window
            .__AQUILA_FINANCE_CACHE_OVERVIEW_R1_2_R2__
            ?.diagnostics?.()
          ?? null,

        generic:
          window
            .__AQUILA_FINANCE_LIVE_DATA_R1_DIAGNOSTICS__
            ?.()
          ?? null,
      };
    },

    reapply() {
      schedule('manual');

      return this.diagnostics();
    },
  };

  window.__AQUILA_FINANCE_RUNTIME_LIFECYCLE_R2_4_INSTALLED__ = true;
}());

/* AQUILA_FINANCE_OVERVIEW_BINDING_R2_5 */
(function(){
'use strict';
if(window.__AQUILA_FINANCE_OVERVIEW_R2_5_INSTALLED__)return;

const S={runs:0,root:false,cards:0,recent:0,receivables:0,payables:0,banks:0,pnlLabels:0,cashLabels:0,lastError:null,lastAppliedAt:null,status:{}};
let inflight=null, cache=null, cacheAt=0, generation=0;
const q=(s,r=document)=>r?.querySelector?.(s)||null;
const qa=(s,r=document)=>r?.querySelectorAll?[...r.querySelectorAll(s)]:[];
const norm=v=>String(v??'').replace(/\s+/g,' ').trim().toLowerCase();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(String(v).replace(/,/g,'')))?Number(String(v).replace(/,/g,'')):null);
const nfmt=v=>num(v)===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(num(v));
const money=v=>num(v)===null?'—':`RWF ${nfmt(v)}`;
const pct=v=>num(v)===null?'—':`${num(v).toFixed(1)}%`;
const nice=v=>{const s=String(v??'').replace(/[_-]+/g,' ').trim();return s?s.replace(/\b\w/g,c=>c.toUpperCase()):'—';};
const at=(o,p)=>String(p).split('.').reduce((a,k)=>a&&typeof a==='object'?a[k]:undefined,o);
const first=(o,ks)=>{for(const k of ks){const v=at(o,k);if(v!==undefined&&v!==null&&v!=='')return v;}return null;};
const firstNum=(o,ks)=>{for(const k of ks){const v=num(at(o,k));if(v!==null)return v;}return null;};

function route(){
 const p=new URLSearchParams(location.hash.replace(/^#/,''));
 return {section:p.get('section'),finance:p.get('finance')||'overview'};
}
function isOverview(){const r=route();return r.section==='finance'&&r.finance==='overview';}
function root(){return q('.finance-reference-v1');}

function auth(){
 for(const store of [localStorage,sessionStorage]){
  let raw=''; try{raw=store.getItem('ubuzima_admin_session')||'';}catch{}
  if(!raw)continue;
  try{
   const p=JSON.parse(raw), x=p.session||p, profile=x.profile||p.profile||x.user?.profile||p.user?.profile||x.user||p.user||{};
   const a=profile.tenant_assignments?.[0]?.tenant;
   const tenant=(typeof a==='string'?a:a?.slug)||profile.tenant?.slug||x.tenant?.slug||p.tenant?.slug||profile.scope?.tenant_slug||x.tenant_slug||p.tenant_slug||'';
   const token=x.token||x.access_token||p.token||p.access_token||'';
   if(token&&tenant)return {token,tenant};
  }catch{}
 }
 return null;
}

function dates(){
 const d=new Date(), from=new Date(d.getFullYear(),d.getMonth(),1);
 const iso=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
 return {from:iso(from),to:iso(d)};
}

async function get(path,a){
 try{
  const r=await fetch(path,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',Authorization:`Bearer ${a.token}`,'X-Tenant-Slug':a.tenant}});
  const payload=await r.json().catch(()=>({}));
  return {ok:r.ok,status:r.status,payload,error:r.ok?null:(payload?.message||`HTTP ${r.status}`)};
 }catch(e){return {ok:false,status:0,payload:{},error:String(e?.message??e)};}
}
function path(base,d,extra={}){
 const u=new URL(base,location.origin);
 for(const [k,v] of Object.entries({...d,...extra}))if(v!==''&&v!==null&&v!==undefined)u.searchParams.set(k,String(v));
 return u.pathname+u.search;
}
function unwrap(x){
 let v=x;
 for(let i=0;i<3;i++){if(v&&!Array.isArray(v)&&typeof v==='object'&&v.data!==undefined&&!v.summary&&!v.rows&&!v.series){v=v.data;continue;}break;}
 return v;
}
function arr(v){return Array.isArray(v)?v:(v&&Array.isArray(v.data)?v.data:null);}
function rows(payload,aliases=[]){
 const r=unwrap(payload); if(Array.isArray(r))return r; if(!r||typeof r!=='object')return [];
 for(const k of ['rows',...aliases,'records','items','sales','receivables','purchase_orders','orders','data']){const a=arr(r[k]);if(a)return a;}
 return [];
}
function series(payload){
 const r=unwrap(payload); if(!r||typeof r!=='object')return [];
 return arr(r.series)||arr(r.trend)||arr(r.timeline)||[];
}
function metric(payload,names){
 const want=names.map(norm), r=unwrap(payload); if(!r||typeof r!=='object')return null;
 for(const c of [r.summary,r.metrics,r.kpis,r.totals,r]){
  if(Array.isArray(c)){
   for(const x of c){if(want.includes(norm(x?.key||x?.code||x?.name||x?.label))){const v=num(x?.value??x?.amount??x?.total??x?.balance);if(v!==null)return v;}}
  }else if(c&&typeof c==='object'){
   for(const [k,x] of Object.entries(c)){if(want.includes(norm(k))){const v=num(x?.value??x?.amount??x?.total??x);if(v!==null)return v;}}
  }
 }
 return null;
}
function account(trial,code){
 const r=trial.find(x=>String(x?.code??x?.account_code??'')===String(code)); if(!r)return null;
 const b=firstNum(r,['balance','closing_balance','net_balance']); if(b!==null)return b;
 const d=firstNum(r,['debit','debit_balance','total_debit'])??0, c=firstNum(r,['credit','credit_balance','total_credit'])??0;
 const t=norm(r.account_type||r.type), normal=norm(r.normal_balance);
 return normal==='credit'||['liability','equity','income','revenue'].includes(t)?c-d:d-c;
}

async function load(force=false){
 if(!force&&cache&&Date.now()-cacheAt<15000)return cache;
 if(inflight)return inflight;
 const a=auth(); if(!a)throw new Error('Admin session or tenant unavailable');
 const d=dates(), common={...d,page:1,per_page:200};
 inflight=Promise.all([
  get(path('/api/v1/pharmaco/finance/commercial/profit-loss',common),a),
  get(path('/api/v1/pharmaco/finance/commercial/cash-flow',common),a),
  get(path('/api/v1/pharmaco/finance/commercial/receivables',common),a),
  get(path('/api/v1/pharmaco/finance/commercial/flow',common),a),
  get('/api/v1/pharmaco/accounting/trial-balance',a),
  get('/api/v1/pharmaco/purchase-orders?per_page=50',a),
 ]).then(x=>{
   const b={pnl:x[0],cash:x[1],recv:x[2],flow:x[3],trial:x[4],po:x[5]};
   if(!b.pnl.ok&&!b.cash.ok&&!b.trial.ok)throw new Error([b.pnl.error,b.cash.error,b.trial.error].filter(Boolean).join(' | '));
   cache=b; cacheAt=Date.now(); return b;
 }).finally(()=>{inflight=null;});
 return inflight;
}

function card(r,label,value,format=nfmt){
 if(value===null)return false;
 const c=qa('.finance-reference-v1__metric',r).find(x=>qa('span,strong,b,small',x).some(n=>norm(n.textContent)===norm(label)));
 if(!c)return false;
 const v=q('.finance-reference-v1__metric-value',c)||qa('strong,b',c).find(x=>norm(x.textContent)!==norm(label));
 if(!v)return false; v.textContent=format(value); return true;
}
function line(panel,label,value){
 if(!panel||value===null)return false;
 const l=qa('span,strong,b,td,th,dt,p,small',panel).find(x=>norm(x.textContent)===norm(label)); if(!l)return false;
 const tr=l.closest('tr');
 if(tr){const td=qa('td',tr);if(td.length>1){td[td.length-1].textContent=value;return true;}}
 const p=l.parentElement;if(!p)return false;
 const a=qa('strong,b,span,dd',p).filter(x=>x!==l&&norm(x.textContent)!==norm(label)); if(!a.length)return false;
 a[a.length-1].textContent=value; return true;
}
function renderTable(panel,data,resolver){
 const table=q('table',panel), body=table&&q('tbody',table), heads=table?qa('thead th',table).map(x=>norm(x.textContent)):[];
 if(!body||!heads.length)return 0;
 const frag=document.createDocumentFragment(), selected=data.slice(0,5);
 if(!selected.length){
  const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=heads.length;td.textContent='No data available';td.className='finance-reference-v1__empty-cell';tr.append(td);frag.append(tr);
 }else for(const row of selected){
  const tr=document.createElement('tr');
  for(const h of heads){const td=document.createElement('td'),v=resolver(h,row);td.textContent=v===null||v===undefined||v===''?'—':String(v);tr.append(td);}
  frag.append(tr);
 }
 body.replaceChildren(frag); return selected.length;
}
const date=v=>String(v??'—').slice(0,10);
function recent(h,x){
 if(h.includes('date'))return date(first(x,['business_date','received_at','paid_at','posting_date','entry_date','created_at']));
 if(h.includes('type'))return nice(first(x,['type','transaction_type','source_type','event_type'])||'Payment');
 if(h.includes('description'))return first(x,['description','memo','narration','reference_number','reference','sale_number','receipt_number'])||'Customer payment';
 if(h.includes('account'))return first(x,['account_name','account','account_code'])||nice(first(x,['payment_method','channel','method']));
 if(h.includes('amount'))return money(firstNum(x,['amount','payment_amount','paid_amount','cash_in','inflow','credit','debit']));
 if(h.includes('status'))return nice(first(x,['status','payment_status','reconciliation_status']));
 return '—';
}
function recv(h,x){
 if(h.includes('customer')||h.includes('payer'))return x.customer?.name||x.customer_name||(x.sale_number?`Operational credit · ${x.sale_number}`:'Operational credit');
 if(h.includes('outstanding')||h.includes('balance')||h.includes('amount'))return money(x.balance_amount??x.outstanding??x.outstanding_amount);
 if(h.includes('age')||h.includes('due'))return x.due_date?date(x.due_date):nice(x.payment_status||x.status);
 if(h.includes('status'))return nice(x.payment_status||x.status);
 return x.sale_number||x.reference_number||'—';
}
function payable(h,x){
 if(h.includes('supplier'))return x.supplier?.name||x.supplier_name||x.vendor_name||'—';
 if(h.includes('reference')||h.includes('invoice')||h==='po')return x.invoice_number||x.purchase_order_number||x.po_number||x.reference_number||x.uuid||x.id;
 if(h.includes('amount')||h.includes('balance')||h.includes('total'))return money(x.balance_amount??x.outstanding_amount??x.total_amount??x.grand_total??x.amount??x.order_total);
 if(h.includes('due')||h.includes('date'))return date(x.due_date||x.expected_delivery_date||x.order_date||x.created_at);
 if(h.includes('status'))return nice(x.status||x.payment_status);
 return '—';
}
function banks(r,trial){
 const box=q('.finance-reference-v1__bank-accounts',r); if(!box)return 0;
 const blocks=Array.from(box.children), defs=[['1000','Cash on Hand'],['1010','Bank Account'],['1020','Card Clearing'],['1030','Mobile Money Clearing']];
 let n=0;
 defs.forEach(([code,name],i)=>{
  const b=blocks[i], row=trial.find(x=>String(x?.code??x?.account_code??'')===code), value=account(trial,code);if(!b||!row||value===null)return;
  const s=q('span',b),v=q('strong',b),sm=q('small',b);if(s)s.textContent=row.name||row.account_name||name;if(v)v.textContent=money(value);if(sm)sm.textContent=`Account ${code}`;n++;
 }); return n;
}

const svg=(name,a={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const[k,v]of Object.entries(a))e.setAttribute(k,String(v));return e;};
function chart(panel,data,defs){
 if(!panel||!data.length)return 0;
 const host=q('.finance-reference-v1__empty-chart',panel)||panel; let s=q('svg',host);
 if(!s){s=svg('svg',{viewBox:'0 0 720 220'});host.append(s);}
 q('[data-aquila-finance-r2-5-series]',s)?.remove();
 qa('span',host).filter(x=>norm(x.textContent).includes('no data')).forEach(x=>x.hidden=true);
 const parsed=defs.map(d=>({...d,values:data.map(d.value)})).filter(d=>d.values.some(v=>num(v)!==null));if(!parsed.length)return 0;
 const vb=s.viewBox?.baseVal,w=vb?.width||720,h=vb?.height||220,L=38,R=18,T=18,B=28,pw=w-L-R,ph=h-T-B;
 const all=parsed.flatMap(d=>d.values).map(num).filter(v=>v!==null),mn=Math.min(0,...all),rawMax=Math.max(0,...all),mx=rawMax===mn?mn+1:rawMax;
 const X=i=>data.length===1?L+pw/2:L+i*pw/(data.length-1),Y=v=>T+(mx-v)/(mx-mn)*ph,g=svg('g',{'data-aquila-finance-r2-5-series':'true'});
 parsed.forEach(d=>{const pts=d.values.map((v,i)=>num(v)===null?null:`${X(i)},${Y(num(v))}`).filter(Boolean);if(pts.length>1)g.append(svg('polyline',{points:pts.join(' '),fill:'none',stroke:d.color,'stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));});
 const idx=data.length<=5?data.map((_,i)=>i):[0,Math.round((data.length-1)/4),Math.round((data.length-1)/2),Math.round(3*(data.length-1)/4),data.length-1];
 let labels=0;
 for(const i of [...new Set(idx)]){
  const v=num(parsed[0].values[i]); if(v===null)continue;
  const t=svg('text',{x:X(i),y:Math.max(10,Y(v)-7),'text-anchor':'middle','font-size':9,fill:parsed[0].color,'data-aquila-finance-data-label':'true'});
  const a=Math.abs(v);t.textContent=a>=1e6?`${(v/1e6).toFixed(1)}M`:a>=1e3?`${Math.round(v/1e3)}K`:`${Math.round(v)}`;g.append(t);labels++;
 }
 s.append(g);return labels;
}
const p1=x=>firstNum(x,['primary','income','revenue','sales','value']);
const p2=x=>firstNum(x,['secondary','expenses','expense','payments','paid']);
const cashIn=x=>firstNum(x,['cash_in','cash_inflow','inflow','receipts','primary','paid','amount_in']);
const cashOut=x=>firstNum(x,['cash_out','cash_outflow','outflow','payments','secondary','amount_out']);
const cashNet=x=>firstNum(x,['net_cash_flow','net_cash','net_flow','net','tertiary']) ?? (cashIn(x)!==null&&cashOut(x)!==null?cashIn(x)-cashOut(x):null);

function applyBundle(r,b){
 const pnl=b.pnl.payload||{}, cash=b.cash.payload||{}, trial=rows(b.trial.payload,['trial_balance','accounts','account_balances']);
 const income=metric(pnl,['total_income','income','total revenue','total_revenue','revenue']);
 const expenses=metric(pnl,['total_expenses','expenses','expense']);
 const net=metric(pnl,['net_profit','net profit','net_income','net income','net']) ?? (income!==null&&expenses!==null?income-expenses:null);
 const margin=metric(pnl,['profit_margin','profit margin','margin']);
 const cogs=account(trial,'5000'), gp=income!==null&&cogs!==null?income-cogs:null, gm=income?((gp??income)/income*100):margin;
 const vals=[
  ['Total Revenue',income,nfmt],['Gross Margin',gm,pct],['Total Expenses',expenses,nfmt],['Net Profit',net,nfmt],
  ['Cash in Hand',account(trial,'1000'),nfmt],['Insurance Receivables',account(trial,'1110'),nfmt],
  ['Accounts Payable',account(trial,'2000'),nfmt],['Inventory Value',account(trial,'1200'),nfmt]
 ];
 S.cards=vals.reduce((n,x)=>n+(card(r,...x)?1:0),0);
 const pp=q('.finance-reference-v1__panel--profit-loss',r);
 line(pp,'Total Revenue',income===null?null:money(income));line(pp,'Cost of Goods Sold',cogs===null?null:money(cogs));line(pp,'Gross Profit',gp===null?null:money(gp));
 line(pp,'Total Expenses',expenses===null?null:money(expenses));line(pp,'Net Profit',net===null?null:money(net));line(pp,'Profit Margin',margin===null?null:pct(margin));
 S.recent=renderTable(q('.finance-reference-v1__panel--transactions',r),rows(cash),recent);
 S.receivables=renderTable(q('.finance-reference-v1__panel--receivables',r),rows(b.recv.payload),recv);
 const flow=rows(b.flow.payload), po=rows(b.po.payload,['purchase_orders','orders']);
 S.payables=renderTable(q('.finance-reference-v1__panel--payables',r),flow.length?flow:po,payable);
 S.banks=banks(r,trial);
 const ps=series(pnl),cs=series(cash);
 S.pnlLabels=chart(q('.finance-reference-v1__panel--revenue',r),ps,[
  {color:'#1ca65b',value:p1},{color:'#ef5350',value:p2},{color:'#2f73d9',value:x=>{const a=p1(x),e=p2(x);return a!==null&&e!==null?a-e:null;}}
 ]);
 S.cashLabels=chart(q('.finance-reference-v1__panel--cash-flow',r),cs,[{color:'#1ca65b',value:cashIn},{color:'#ef5350',value:cashOut},{color:'#2f73d9',value:cashNet}]);
 S.status={profit_loss:b.pnl.status,cash_flow:b.cash.status,receivables:b.recv.status,flow:b.flow.status,trial_balance:b.trial.status,purchase_orders:b.po.status};
 S.lastError=null;S.lastAppliedAt=new Date().toISOString();r.setAttribute('data-aquila-finance-overview-r2-5','bound');return true;
}

async function apply(force=false){
 if(!isOverview())return false;S.runs++;
 const r=root();S.root=!!r;if(!r){S.lastError='.finance-reference-v1 not mounted';return false;}
 try{const b=await load(force);if(!isOverview()||!root())return false;return applyBundle(root(),b);}
 catch(e){S.lastError=String(e?.message??e);return false;}
}
function schedule(force=false){
 const g=++generation;[].forEach((d,i)=>setTimeout(()=>{if(g===generation&&isOverview())void apply(force&&i===0);},d));
}

window.__AQUILA_FINANCE_OVERVIEW_APPLY_R2_4__=()=>apply(false);
window.__AQUILA_FINANCE_OVERVIEW_R2_5__={apply:()=>apply(true),diagnostics:()=>({release:'AQUILA_FINANCE_OVERVIEW_BINDING_R2_5',route:route(),...S,currentRoot:root()?.className||null})};

addEventListener('hashchange',()=>schedule(false),{passive:true});
addEventListener('pageshow',()=>schedule(false),{passive:true});
document.addEventListener('change',e=>{if(isOverview()&&e.target instanceof Element&&root()?.contains(e.target)){cache=null;cacheAt=0;schedule(true);}},{passive:true});
window.__AQUILA_FINANCE_OVERVIEW_R2_5_INSTALLED__=true;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(false),{once:true});else schedule(false);
}());

/* AQUILA_FINANCE_OVERVIEW_BINDING_R2_5_1 */

/* AQUILA_FINANCE_VISUAL_POLISH_R2_6 */
(function () {
  'use strict';

  if (
    window
      .__AQUILA_FINANCE_VISUAL_POLISH_R2_6_INSTALLED__
  ) {
    return;
  }

  const RELEASE =
    'AQUILA_FINANCE_VISUAL_POLISH_R2_6';

  const STYLE_ID =
    'aquila-finance-visual-polish-r2-6-style';

  const state = {
    release: RELEASE,
    runs: 0,
    workspace: null,
    recentTransactionsPolished: false,
    chartTargetsFound: 0,
    chartTargetsPolished: 0,
    overlaysRendered: 0,
    datesRendered: 0,
    valueLabelsRendered: 0,
    gridLinesHidden: 0,
    salesReturnsSource: null,
    lastAppliedAt: null,
    lastError: null,
  };

  let generation = 0;

  const requestCache = new Map();

  const q = (
    selector,
    root = document
  ) =>
    root?.querySelector?.(selector)
    || null;

  const qa = (
    selector,
    root = document
  ) =>
    root?.querySelectorAll
      ? [
          ...root.querySelectorAll(
            selector
          ),
        ]
      : [];

  const normalize = (value) =>
    String(
      value ?? ''
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim()
      .toLowerCase();

  const numberValue = (value) => {
    if (
      value === null
      || value === undefined
      || value === ''
    ) {
      return null;
    }

    const parsed = Number(
      String(value)
        .replace(
          /,/g,
          ''
        )
    );

    return Number.isFinite(
      parsed
    )
      ? parsed
      : null;
  };

  const firstNumber = (
    row,
    keys
  ) => {
    for (
      const key
      of keys
    ) {
      const value =
        numberValue(
          row?.[key]
        );

      if (
        value !== null
      ) {
        return value;
      }
    }

    return null;
  };

  function routeState() {
    const params =
      new URLSearchParams(
        window.location.hash
          .replace(
            /^#/,
            ''
          )
      );

    return {
      section:
        params.get(
          'section'
        ),
      finance:
        params.get(
          'finance'
        )
        || 'overview',
    };
  }

  function isFinance() {
    return (
      routeState()
        .section
      === 'finance'
    );
  }

  function workspaceRoot(
    workspace
  ) {
    switch (
      workspace
    ) {
      case 'overview':
        return q(
          '.finance-reference-v1'
        );

      case 'financial-statements':
        return q(
          '.profit-loss-v1'
        );

      case 'cash-flow':
        return q(
          '.cash-flow-v1'
        );

      case 'sales':
        return q(
          '.finance-sales-v1'
        );

      default:
        return null;
    }
  }

  function ensureStyle() {
    if (
      document.getElementById(
        STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style'
      );

    style.id =
      STYLE_ID;

    style.textContent = `
/*
 * AQUILA FINANCE VISUAL POLISH R2.6
 * Existing Finance UI only.
 */

/* --------------------------------------------------------------
 * Finance Overview · Recent Transactions
 * Make Description dominant and keep every row to one line.
 * -------------------------------------------------------------- */
.finance-reference-v1__panel--transactions {
  min-width: 0 !important;
  overflow-x: auto !important;
}

.finance-reference-v1__panel--transactions table[data-aquila-finance-r2-6-recent] {
  width: 100% !important;
  min-width: 840px !important;
  table-layout: fixed !important;
}

.finance-reference-v1__panel--transactions table[data-aquila-finance-r2-6-recent] th,
.finance-reference-v1__panel--transactions table[data-aquila-finance-r2-6-recent] td {
  white-space: nowrap !important;
  vertical-align: middle !important;
}

.finance-reference-v1__panel--transactions table[data-aquila-finance-r2-6-recent] td[data-aquila-finance-r2-6-description] {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

/* --------------------------------------------------------------
 * Hide the previous coloured text-only Finance data labels.
 * R2.6 replaces them with black-label / white-text labels.
 * -------------------------------------------------------------- */
.finance-reference-v1 [data-aquila-finance-data-label],
.profit-loss-v1 [data-aquila-finance-data-label],
.cash-flow-v1 [data-aquila-finance-data-label],
.finance-sales-v1 [data-aquila-finance-data-label] {
  display: none !important;
}

/* --------------------------------------------------------------
 * Targeted eight Finance charts only.
 * Remove background SVG grid/axis lines.
 * Data paths, polylines, areas, bars and points remain intact.
 * -------------------------------------------------------------- */
.aquila-finance-r2-6-chart-target svg line {
  display: none !important;
}

.aquila-finance-r2-6-chart-target svg [class*="grid"],
.aquila-finance-r2-6-chart-target svg [class*="Grid"],
.aquila-finance-r2-6-chart-target svg [class*="guide"],
.aquila-finance-r2-6-chart-target svg [class*="Guide"] {
  display: none !important;
}

/* R2.6 value labels */
[data-aquila-finance-r2-6-overlay] .aquila-finance-r2-6-value-bg {
  fill: #000000 !important;
  stroke: #000000 !important;
  stroke-width: 1 !important;
}

[data-aquila-finance-r2-6-overlay] .aquila-finance-r2-6-value-text {
  fill: #ffffff !important;
  font-family: inherit !important;
  font-size: 9px !important;
  font-weight: 800 !important;
  letter-spacing: 0 !important;
  pointer-events: none !important;
}

/* Date labels remain neutral and readable beneath the graph. */
[data-aquila-finance-r2-6-overlay] .aquila-finance-r2-6-date-text {
  fill: #475569 !important;
  font-family: inherit !important;
  font-size: 9px !important;
  font-weight: 700 !important;
  pointer-events: none !important;
}

.aquila-finance-r2-6-date-footer {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 0.35rem !important;
  width: 100% !important;
  margin-top: 0.35rem !important;
  padding: 0 0.15rem !important;
  color: #475569 !important;
  font-size: 0.66rem !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
}

.aquila-finance-r2-6-date-footer span {
  white-space: nowrap !important;
}

@media (max-width: 768px) {
  .finance-reference-v1__panel--transactions table[data-aquila-finance-r2-6-recent] {
    min-width: 760px !important;
  }

  [data-aquila-finance-r2-6-overlay] .aquila-finance-r2-6-value-text,
  [data-aquila-finance-r2-6-overlay] .aquila-finance-r2-6-date-text {
    font-size: 8px !important;
  }
}
`;

    document.head
      .appendChild(
        style
      );
  }

  function authContext() {
    const stores = [
      window.localStorage,
      window.sessionStorage,
    ];

    for (
      const store
      of stores
    ) {
      let raw = '';

      try {
        raw =
          store.getItem(
            'ubuzima_admin_session'
          )
          || '';
      } catch {
        raw = '';
      }

      if (
        !raw
      ) {
        continue;
      }

      try {
        const parsed =
          JSON.parse(
            raw
          );

        const session =
          parsed.session
          || parsed;

        const profile =
          session.profile
          || parsed.profile
          || session.user?.profile
          || parsed.user?.profile
          || session.user
          || parsed.user
          || {};

        const assignment =
          profile
            .tenant_assignments?.[0]
            ?.tenant;

        const tenant =
          (
            typeof assignment
            === 'string'
              ? assignment
              : assignment?.slug
          )
          || profile.tenant?.slug
          || session.tenant?.slug
          || parsed.tenant?.slug
          || profile.scope?.tenant_slug
          || session.tenant_slug
          || parsed.tenant_slug
          || '';

        const token =
          session.token
          || session.access_token
          || parsed.token
          || parsed.access_token
          || '';

        if (
          token
          && tenant
        ) {
          return {
            token,
            tenant,
          };
        }
      } catch {
        // Keep searching available session stores.
      }
    }

    return null;
  }

  function fallbackRange() {
    const today =
      new Date();

    const from =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

    const iso = (
      value
    ) => [
      value.getFullYear(),
      String(
        value.getMonth()
        + 1
      ).padStart(
        2,
        '0'
      ),
      String(
        value.getDate()
      ).padStart(
        2,
        '0'
      ),
    ].join(
      '-'
    );

    return {
      from:
        iso(from),
      to:
        iso(today),
    };
  }

  function rangeFromDom(
    root
  ) {
    const fallback =
      fallbackRange();

    if (
      !root
    ) {
      return fallback;
    }

    const values =
      qa(
        'input[type="date"]',
        root
      )
        .map(
          (input) =>
            String(
              input.value
              || ''
            ).trim()
        )
        .filter(
          (value) =>
            /^\d{4}-\d{2}-\d{2}$/
              .test(
                value
              )
        );

    if (
      values.length >= 2
    ) {
      return {
        from:
          values[0],
        to:
          values[1],
      };
    }

    if (
      values.length === 1
    ) {
      return {
        from:
          fallback.from,
        to:
          values[0],
      };
    }

    return fallback;
  }

  async function getJson(
    url,
    auth
  ) {
    const cacheKey =
      auth.token.slice(
        -12
      )
      + '|'
      + auth.tenant
      + '|'
      + url;

    const cached =
      requestCache.get(
        cacheKey
      );

    if (
      cached
      && (
        Date.now()
        - cached.time
      ) < 15000
    ) {
      return cached.value;
    }

    const promise =
      fetch(
        url,
        {
          method: 'GET',
          credentials:
            'same-origin',
          cache:
            'no-store',
          headers: {
            Accept:
              'application/json',
            Authorization:
              'Bearer '
              + auth.token,
            'X-Tenant-Slug':
              auth.tenant,
          },
        }
      )
        .then(
          async (
            response
          ) => {
            const payload =
              await response
                .json()
                .catch(
                  () => ({})
                );

            return {
              ok:
                response.ok,
              status:
                response.status,
              payload,
            };
          }
        )
        .catch(
          (
            error
          ) => ({
            ok: false,
            status: 0,
            payload: {},
            error:
              String(
                error?.message
                ?? error
              ),
          })
        );

    requestCache.set(
      cacheKey,
      {
        time:
          Date.now(),
        value:
          promise,
      }
    );

    return promise;
  }

  function endpointUrl(
    endpoint,
    range
  ) {
    const url =
      new URL(
        '/api/v1/pharmaco/finance/commercial/'
          + endpoint,
        window.location.origin
      );

    url.searchParams.set(
      'from',
      range.from
    );

    url.searchParams.set(
      'to',
      range.to
    );

    url.searchParams.set(
      'page',
      '1'
    );

    url.searchParams.set(
      'per_page',
      '200'
    );

    return (
      url.pathname
      + url.search
    );
  }

  function unwrap(
    payload
  ) {
    let value =
      payload;

    for (
      let index = 0;
      index < 3;
      index += 1
    ) {
      if (
        value
        && !Array.isArray(
          value
        )
        && typeof value
          === 'object'
        && value.data
          !== undefined
        && !value.series
        && !value.rows
        && !value.summary
      ) {
        value =
          value.data;

        continue;
      }

      break;
    }

    return value;
  }

  function seriesFrom(
    payload
  ) {
    const value =
      unwrap(
        payload
      );

    if (
      !value
      || typeof value
        !== 'object'
    ) {
      return [];
    }

    const candidates = [
      value.series,
      value.trend,
      value.timeline,
      value.data?.series,
    ];

    for (
      const candidate
      of candidates
    ) {
      if (
        Array.isArray(
          candidate
        )
      ) {
        return [
          ...candidate,
        ].sort(
          (
            left,
            right
          ) =>
            String(
              left?.label
              || left?.business_date
              || left?.date
              || ''
            ).localeCompare(
              String(
                right?.label
                || right?.business_date
                || right?.date
                || ''
              )
            )
        );
      }
    }

    return [];
  }

  function rowDate(
    row
  ) {
    return String(
      row?.label
      || row?.business_date
      || row?.date
      || ''
    )
      .slice(
        0,
        10
      );
  }

  function primaryValue(
    row
  ) {
    return firstNumber(
      row,
      [
        'primary',
        'income',
        'revenue',
        'sales',
        'total',
        'value',
      ]
    );
  }

  function secondaryValue(
    row
  ) {
    return firstNumber(
      row,
      [
        'secondary',
        'expenses',
        'expense',
        'returns',
        'outflow',
        'payments',
        'paid',
      ]
    );
  }

  function pnlNet(
    row
  ) {
    const explicit =
      firstNumber(
        row,
        [
          'net_profit',
          'net_income',
          'net',
          'tertiary',
        ]
      );

    if (
      explicit !== null
    ) {
      return explicit;
    }

    const income =
      primaryValue(
        row
      );

    const expense =
      secondaryValue(
        row
      );

    return (
      income !== null
      && expense !== null
    )
      ? income
        - expense
      : null;
  }

  function cashNet(
    row
  ) {
    const explicit =
      firstNumber(
        row,
        [
          'net_cash_flow',
          'net_cash',
          'net_flow',
          'net',
          'tertiary',
        ]
      );

    if (
      explicit !== null
    ) {
      return explicit;
    }

    /*
     * The commercial Cash Flow series already exposes the
     * verified primary movement. Do not manufacture a new
     * investing/financing classification.
     */
    return primaryValue(
      row
    );
  }

  function compactNumber(
    raw
  ) {
    const value =
      numberValue(
        raw
      );

    if (
      value === null
    ) {
      return '';
    }

    const absolute =
      Math.abs(
        value
      );

    if (
      absolute >= 1000000000
    ) {
      return (
        value
        / 1000000000
      ).toFixed(
        1
      )
        .replace(
          /\.0$/,
          ''
        )
        + 'B';
    }

    if (
      absolute >= 1000000
    ) {
      return (
        value
        / 1000000
      ).toFixed(
        1
      )
        .replace(
          /\.0$/,
          ''
        )
        + 'M';
    }

    if (
      absolute >= 1000
    ) {
      return (
        value
        / 1000
      ).toFixed(
        1
      )
        .replace(
          /\.0$/,
          ''
        )
        + 'K';
    }

    return Math.round(
      value
    ).toLocaleString(
      'en-US'
    );
  }

  function dateLabel(
    raw
  ) {
    const value =
      String(
        raw
        || ''
      )
        .slice(
          0,
          10
        );

    const match =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

    if (
      !match
    ) {
      return value;
    }

    const date =
      new Date(
        Number(
          match[1]
        ),
        Number(
          match[2]
        ) - 1,
        Number(
          match[3]
        )
      );

    return new Intl
      .DateTimeFormat(
        'en-GB',
        {
          day:
            '2-digit',
          month:
            'short',
        }
      )
      .format(
        date
      );
  }

  function findPanelByTitle(
    root,
    title
  ) {
    if (
      !root
    ) {
      return null;
    }

    const wanted =
      normalize(
        title
      );

    const headings =
      qa(
        'h1,h2,h3,h4,h5,h6,strong,b',
        root
      );

    let heading =
      headings.find(
        (element) =>
          normalize(
            element.textContent
          ) === wanted
      );

    if (
      !heading
    ) {
      heading =
        headings.find(
          (element) =>
            normalize(
              element.textContent
            ).includes(
              wanted
            )
        );
    }

    if (
      !heading
    ) {
      return null;
    }

    const candidates = [
      heading.closest(
        'article'
      ),
      heading.closest(
        '[class*="panel"]'
      ),
      heading.closest(
        '[class*="chart"]'
      ),
      heading.parentElement
        ?.parentElement,
    ];

    for (
      const candidate
      of candidates
    ) {
      if (
        candidate
        && candidate !== root
        && root.contains(
          candidate
        )
      ) {
        return candidate;
      }
    }

    return null;
  }

  function svgArea(
    svg
  ) {
    const viewBox =
      svg?.viewBox
        ?.baseVal;

    if (
      viewBox
      && viewBox.width
      && viewBox.height
    ) {
      return (
        viewBox.width
        * viewBox.height
      );
    }

    const box =
      svg?.getBoundingClientRect?.();

    return (
      box?.width
      || 0
    ) * (
      box?.height
      || 0
    );
  }

  function chartSvg(
    panel
  ) {
    if (
      !panel
    ) {
      return null;
    }

    const svgs =
      qa(
        'svg',
        panel
      )
        .filter(
          (svg) =>
            !svg.closest(
              'button'
            )
        )
        .sort(
          (
            left,
            right
          ) =>
            svgArea(
              right
            )
            - svgArea(
              left
            )
        );

    return (
      svgs[0]
      || null
    );
  }

  function createSvg(
    name,
    attributes = {}
  ) {
    const element =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        name
      );

    for (
      const [
        key,
        value,
      ]
      of Object.entries(
        attributes
      )
    ) {
      element.setAttribute(
        key,
        String(
          value
        )
      );
    }

    return element;
  }

  function selectedIndices(
    data,
    definitions
  ) {
    if (
      !data.length
    ) {
      return [];
    }

    if (
      data.length <= 5
    ) {
      return data.map(
        (
          _row,
          index
        ) =>
          index
      );
    }

    const last =
      data.length
      - 1;

    const indices =
      new Set([
        0,
        Math.round(
          last / 4
        ),
        Math.round(
          last / 2
        ),
        Math.round(
          last * 3 / 4
        ),
        last,
      ]);

    /*
     * Preserve meaningful return/refund points even when they
     * fall between regular date samples.
     */
    definitions.forEach(
      (
        definition,
        definitionIndex
      ) => {
        if (
          definitionIndex === 0
        ) {
          return;
        }

        data.forEach(
          (
            row,
            index
          ) => {
            const value =
              numberValue(
                definition.value(
                  row,
                  index
                )
              );

            if (
              value !== null
              && value !== 0
              && indices.size < 7
            ) {
              indices.add(
                index
              );
            }
          }
        );
      }
    );

    return [
      ...indices,
    ]
      .sort(
        (
          left,
          right
        ) =>
          left
          - right
      )
      .slice(
        0,
        7
      );
  }

  function renderDateFooter(
    panel,
    data,
    indices
  ) {
    if (
      !panel
      || !indices.length
    ) {
      return 0;
    }

    let footer =
      q(
        ':scope > .aquila-finance-r2-6-date-footer',
        panel
      );

    if (
      !footer
    ) {
      footer =
        document.createElement(
          'div'
        );

      footer.className =
        'aquila-finance-r2-6-date-footer';

      panel.appendChild(
        footer
      );
    }

    footer.replaceChildren(
      ...indices.map(
        (
          index
        ) => {
          const span =
            document.createElement(
              'span'
            );

          span.textContent =
            dateLabel(
              rowDate(
                data[
                  index
                ]
              )
            );

          return span;
        }
      )
    );

    return indices.length;
  }

  function removeR26Overlay(
    svg
  ) {
    qa(
      '[data-aquila-finance-r2-6-overlay]',
      svg
    ).forEach(
      (
        element
      ) =>
        element.remove()
    );
  }

  function renderOverlay(
  panel,
  data,
  definitions
) {
  if(!panel){
    return {
      polished:false,
      labels:0,
      dates:0,
      grid:0
    };
  }

  /*
   * Remove obsolete annotation layers.
   */
  Array.from(
    panel.querySelectorAll(
      "[data-aquila-finance-r2-6-overlay],"
      +
      "[data-aquila-finance-r21-annotations],"
      +
      ".aquila-finance-r2-6-date-footer"
    )
  ).forEach(
    element =>
      element.remove()
  );

  /*
   * R291 charts:
   * newest appended chart is authoritative.
   * Remove EVERY older chart, not just one.
   */
  const r291Scrolls =
    Array.from(
      panel.querySelectorAll(
        "[data-aquila-finance-r291-scroll]"
      )
    );

  let keptSvg=null;

  if(r291Scrolls.length){
    const keep =
      r291Scrolls[
        r291Scrolls.length-1
      ];

    r291Scrolls
      .slice(
        0,
        -1
      )
      .forEach(
        element =>
          element.remove()
      );

    /*
     * An active R291 chart supersedes old R2.7 canvases.
     */
    Array.from(
      panel.querySelectorAll(
        "[data-aquila-finance-r2-7-canvas]"
      )
    ).forEach(
      element =>
        element.remove()
    );

    keptSvg =
      keep.querySelector(
        "svg[data-aquila-finance-r291-chart]"
      )
      ||
      keep.querySelector(
        "svg"
      );
  }
  else{
    const r27Canvases =
      Array.from(
        panel.querySelectorAll(
          "[data-aquila-finance-r2-7-canvas]"
        )
      );

    if(r27Canvases.length){
      const keep =
        r27Canvases[
          r27Canvases.length-1
        ];

      r27Canvases
        .slice(
          0,
          -1
        )
        .forEach(
          element =>
            element.remove()
        );

      keptSvg =
        keep.querySelector(
          "svg[data-aquila-finance-r2-7-chart]"
        )
        ||
        keep.querySelector(
          "svg"
        );
    }
  }

  if(!keptSvg){
    const svgs =
      Array.from(
        panel.querySelectorAll(
          "svg"
        )
      );

    keptSvg =
      svgs.length
        ? svgs[
            svgs.length-1
          ]
        : null;
  }

  if(!keptSvg){
    return {
      polished:false,
      labels:0,
      dates:0,
      grid:0
    };
  }

  /*
   * Remove known date annotations belonging to non-authoritative
   * SVGs/canvases.
   */
  Array.from(
    panel.querySelectorAll(
      ".r291-date-text,"
      +
      ".aquila-finance-r2-7-date,"
      +
      ".aquila-finance-r2-6-date-text,"
      +
      ".aquila-finance-r21-date-text"
    )
  ).forEach(
    element => {
      if(
        !keptSvg.contains(
          element
        )
      ){
        element.remove();
      }
    }
  );

  /*
   * De-duplicate dates inside the authoritative SVG itself.
   */
  const seenDates =
    new Set();

  Array.from(
    keptSvg.querySelectorAll(
      ".r291-date-text,"
      +
      ".aquila-finance-r2-7-date"
    )
  ).forEach(
    element => {
      const key =
        String(
          element.textContent
          ||
          ""
        )
        +
        "|"
        +
        String(
          element.getAttribute(
            "x"
          )
          ||
          ""
        );

      if(
        seenDates.has(key)
      ){
        element.remove();
        return;
      }

      seenDates.add(key);

      element.style.setProperty(
        "display",
        "inline",
        "important"
      );

      element.style.setProperty(
        "visibility",
        "visible",
        "important"
      );

      element.style.setProperty(
        "opacity",
        "1",
        "important"
      );
    }
  );

  /*
   * renderChart already creates value labels.
   * Do not recreate them. Just make those exact nodes visible.
   */
  const labelTexts =
    Array.from(
      keptSvg.querySelectorAll(
        ".r291-label-text,"
        +
        ".aquila-finance-r2-7-label-text,"
        +
        ".aquila-finance-r22-direct-label"
      )
    );

  labelTexts.forEach(
    element => {
      element.style.setProperty(
        "display",
        "inline",
        "important"
      );

      element.style.setProperty(
        "visibility",
        "visible",
        "important"
      );

      element.style.setProperty(
        "opacity",
        "1",
        "important"
      );

      const parent =
        element.parentElement;

      if(parent){
        parent.style.setProperty(
          "display",
          "inline",
          "important"
        );

        parent.style.setProperty(
          "visibility",
          "visible",
          "important"
        );

        parent.style.setProperty(
          "opacity",
          "1",
          "important"
        );
      }
    }
  );

  return {
    polished:true,
    labels:
      labelTexts.length,
    dates:
      seenDates.size,
    grid:0
  };
}

  function polishRecentTransactions(
    root
  ) {
    const panel =
      q(
        '.finance-reference-v1__panel--transactions',
        root
      );

    const table =
      panel
      && q(
        'table',
        panel
      );

    if (
      !panel
      || !table
    ) {
      return false;
    }

    const headers =
      qa(
        'thead th',
        table
      );

    if (
      !headers.length
    ) {
      return false;
    }

    table.setAttribute(
      'data-aquila-finance-r2-6-recent',
      'true'
    );

    const widthFor =
      (
        heading,
        index
      ) => {
        const text =
          normalize(
            heading
              .textContent
          );

        if (
          text.includes(
            'description'
          )
        ) {
          return '45%';
        }

        if (
          text.includes(
            'date'
          )
        ) {
          return '13%';
        }

        if (
          text.includes(
            'type'
          )
        ) {
          return '9%';
        }

        if (
          text.includes(
            'account'
          )
        ) {
          return '12%';
        }

        if (
          text.includes(
            'amount'
          )
        ) {
          return '13%';
        }

        if (
          text.includes(
            'status'
          )
        ) {
          return '8%';
        }

        /*
         * Conservative compact fallback.
         */
        return index === 2
          ? '45%'
          : '11%';
      };

    let descriptionIndex =
      -1;

    headers.forEach(
      (
        heading,
        index
      ) => {
        const width =
          widthFor(
            heading,
            index
          );

        heading.style.width =
          width;

        heading.style
          .whiteSpace =
          'nowrap';

        if (
          normalize(
            heading
              .textContent
          ).includes(
            'description'
          )
        ) {
          descriptionIndex =
            index;
        }
      }
    );

    if (
      descriptionIndex < 0
      && headers.length >= 3
    ) {
      descriptionIndex = 2;
    }

    qa(
      'tbody tr',
      table
    ).forEach(
      (
        row
      ) => {
        [
          ...row.children,
        ].forEach(
          (
            cell,
            index
          ) => {
            if (
              !(cell instanceof HTMLElement)
            ) {
              return;
            }

            cell.style.width =
              widthFor(
                headers[
                  index
                ]
                || {
                  textContent: '',
                },
                index
              );

            cell.style
              .whiteSpace =
              'nowrap';

            if (
              index
              === descriptionIndex
            ) {
              cell.setAttribute(
                'data-aquila-finance-r2-6-description',
                'true'
              );

              cell.style
                .overflow =
                'hidden';

              cell.style
                .textOverflow =
                'ellipsis';

              const fullText =
                String(
                  cell.textContent
                  || ''
                ).trim();

              if (
                fullText
              ) {
                cell.title =
                  fullText;
              }
            }
          }
        );
      }
    );

    return true;
  }

  async function loadCommercialSeries(
    endpoint,
    range,
    auth
  ) {
    const response =
      await getJson(
        endpointUrl(
          endpoint,
          range
        ),
        auth
      );

    if (
      !response.ok
    ) {
      return {
        ok: false,
        status:
          response.status,
        series: [],
      };
    }

    return {
      ok: true,
      status:
        response.status,
      series:
        seriesFrom(
          response.payload
        ),
    };
  }

  async function loadRefundMap(
    range,
    auth
  ) {
    const response =
      await getJson(
        '/api/v1/pharmaco/sales/returns',
        auth
      );

    state.salesReturnsSource =
      response.status;

    if (
      !response.ok
    ) {
      return null;
    }

    const unwrapped =
      unwrap(
        response.payload
      );

    let rows = [];

    if (
      Array.isArray(
        unwrapped
      )
    ) {
      rows =
        unwrapped;
    } else if (
      Array.isArray(
        unwrapped?.returns
      )
    ) {
      rows =
        unwrapped.returns;
    } else if (
      Array.isArray(
        unwrapped?.data
      )
    ) {
      rows =
        unwrapped.data;
    } else if (
      Array.isArray(
        response.payload
          ?.returns
      )
    ) {
      rows =
        response.payload
          .returns;
    }

    const refundMap =
      new Map();

    rows
      .filter(
        (
          row
        ) =>
          normalize(
            row?.status
          )
          === 'refunded'
      )
      .forEach(
        (
          row
        ) => {
          const date =
            String(
              row?.refunded_at
              || row?.approved_at
              || row?.requested_at
              || ''
            )
              .slice(
                0,
                10
              );

          if (
            !date
            || date < range.from
            || date > range.to
          ) {
            return;
          }

          const amount =
            numberValue(
              row
                ?.approved_refund_amount
            )
            ?? numberValue(
              row
                ?.requested_refund_amount
            );

          if (
            amount === null
          ) {
            return;
          }

          refundMap.set(
            date,
            (
              refundMap.get(
                date
              )
              || 0
            )
            + amount
          );
        }
      );

    return refundMap;
  }

  function accumulateResult(
    result
  ) {
    if (
      !result
    ) {
      return;
    }

    if (
      result.polished
    ) {
      state
        .chartTargetsPolished
        += 1;

      state
        .overlaysRendered
        += 1;
    }

    state
      .valueLabelsRendered
      += result.labels
      || 0;

    state
      .datesRendered
      += result.dates
      || 0;

    state
      .gridLinesHidden
      += result.grid
      || 0;
  }

  async function polishOverview(
    root,
    range,
    auth
  ) {
    state.recentTransactionsPolished =
      polishRecentTransactions(
        root
      );

    const [
      pnl,
      cash,
    ] =
      await Promise.all([
        loadCommercialSeries(
          'profit-loss',
          range,
          auth
        ),
        loadCommercialSeries(
          'cash-flow',
          range,
          auth
        ),
      ]);

    const revenuePanel =
      findPanelByTitle(
        root,
        'Revenue vs Expenses'
      )
      || q(
        '.finance-reference-v1__panel--revenue',
        root
      );

    const cashPanel =
      findPanelByTitle(
        root,
        'Cash Flow Overview'
      )
      || q(
        '.finance-reference-v1__panel--cash-flow',
        root
      );

    if (
      revenuePanel
    ) {
      state.chartTargetsFound += 1;

      accumulateResult(
        renderOverlay(
          revenuePanel,
          pnl.series,
          [
            {
              value:
                primaryValue,
            },
            {
              value:
                secondaryValue,
            },
          ]
        )
      );
    }

    if (
      cashPanel
    ) {
      state.chartTargetsFound += 1;

      accumulateResult(
        renderOverlay(
          cashPanel,
          cash.series,
          [
            {
              value:
                primaryValue,
            },
            {
              value:
                secondaryValue,
            },
          ]
        )
      );
    }
  }

  async function polishProfitLoss(
    root,
    range,
    auth
  ) {
    const data =
      await loadCommercialSeries(
        'profit-loss',
        range,
        auth
      );

    const incomePanel =
      findPanelByTitle(
        root,
        'Income vs Expenses'
      );

    const netPanel =
      findPanelByTitle(
        root,
        'Net Profit Trend'
      );

    if (
      incomePanel
    ) {
      state.chartTargetsFound += 1;

      accumulateResult(
        renderOverlay(
          incomePanel,
          data.series,
          [
            {
              value:
                primaryValue,
            },
            {
              value:
                secondaryValue,
            },
          ]
        )
      );
    }

    if (
      netPanel
    ) {
      state.chartTargetsFound += 1;

      accumulateResult(
        renderOverlay(
          netPanel,
          data.series,
          [
            {
              value:
                pnlNet,
            },
          ]
        )
      );
    }
  }

  async function polishCashFlow(
    root,
    range,
    auth
  ) {
    const data =
      await loadCommercialSeries(
        'cash-flow',
        range,
        auth
      );

    const comparisonPanel =
      findPanelByTitle(
        root,
        'Cash Inflow vs Cash Outflow'
      );

    const netPanel =
      findPanelByTitle(
        root,
        'Net Cash Flow Trend'
      );

    if (
      comparisonPanel
    ) {
      state.chartTargetsFound += 1;

      accumulateResult(
        renderOverlay(
          comparisonPanel,
          data.series,
          [
            {
              value:
                primaryValue,
            },
            {
              value:
                secondaryValue,
            },
          ]
        )
      );
    }

    if (
      netPanel
    ) {
      state.chartTargetsFound += 1;

      accumulateResult(
        renderOverlay(
          netPanel,
          data.series,
          [
            {
              value:
                cashNet,
            },
          ]
        )
      );
    }
  }

  async function polishSales(
    root,
    range,
    auth
  ) {
    const [
      data,
      refundMap,
    ] =
      await Promise.all([
        loadCommercialSeries(
          'sales',
          range,
          auth
        ),
        loadRefundMap(
          range,
          auth
        ),
      ]);

    const salesPanel =
      findPanelByTitle(
        root,
        'Sales vs Returns'
      );

    const revenuePanel =
      findPanelByTitle(
        root,
        'Revenue Trend'
      );

    const actualReturns =
      (
        row
      ) => {
        if (
          !refundMap
        ) {
          return null;
        }

        return (
          refundMap.get(
            rowDate(
              row
            )
          )
          || 0
        );
      };

    if (
      salesPanel
    ) {
      state.chartTargetsFound += 1;

      const definitions = [
        {
          value:
            primaryValue,
        },
      ];

      /*
       * Only add Returns labels when the genuine Sales Return
       * source is available. Never reinterpret "paid" as Returns.
       */
      if (
        refundMap
      ) {
        definitions.push(
          {
            value:
              actualReturns,
            hideZero:
              true,
          }
        );
      }

      accumulateResult(
        renderOverlay(
          salesPanel,
          data.series,
          definitions
        )
      );
    }

    if (
      revenuePanel
    ) {
      state.chartTargetsFound += 1;

      accumulateResult(
        renderOverlay(
          revenuePanel,
          data.series,
          [
            {
              value:
                primaryValue,
            },
          ]
        )
      );
    }
  }

  async function apply() {
    if (
      !isFinance()
    ) {
      return false;
    }

    state.runs += 1;
    state.chartTargetsFound = 0;
    state.chartTargetsPolished = 0;
    state.overlaysRendered = 0;
    state.datesRendered = 0;
    state.valueLabelsRendered = 0;
    state.gridLinesHidden = 0;
    state.lastError = null;

    ensureStyle();

    const route =
      routeState();

    state.workspace =
      route.finance;

    const root =
      workspaceRoot(
        route.finance
      );

    if (
      !root
    ) {
      state.lastError =
        'Current Finance workspace root is not mounted yet.';

      return false;
    }

    const auth =
      authContext();

    if (
      !auth
    ) {
      state.lastError =
        'Authenticated Admin session or tenant is unavailable.';

      return false;
    }

    const range =
      rangeFromDom(
        root
      );

    try {
      switch (
        route.finance
      ) {
        case 'overview':
          await polishOverview(
            root,
            range,
            auth
          );
          break;

        case 'financial-statements':
          await polishProfitLoss(
            root,
            range,
            auth
          );
          break;

        case 'cash-flow':
          await polishCashFlow(
            root,
            range,
            auth
          );
          break;

        case 'sales':
          await polishSales(
            root,
            range,
            auth
          );
          break;

        default:
          return false;
      }

      state.lastAppliedAt =
        new Date()
          .toISOString();

      root.setAttribute(
        'data-aquila-finance-visual-polish-r2-6',
        'active'
      );

      return true;
    } catch (
      error
    ) {
      state.lastError =
        String(
          error?.message
          ?? error
        );

      return false;
    }
  }

  function schedule() {
    const current =
      ++generation;

    /*
     * Intentionally offset from the R2.5.1 data-binding passes.
     * This allows the existing UI/data binder to render first,
     * then applies presentation-only chart/table polish.
     */
    [].forEach(
      (
        delay
      ) => {
        window.setTimeout(
          () => {
            if (
              current
                === generation
              && isFinance()
            ) {
              void apply();
            }
          },
          delay
        );
      }
    );
  }

  window
    .__AQUILA_FINANCE_VISUAL_POLISH_R2_6__ = {
      apply:
        () => apply(),

      diagnostics:
        () => ({
          ...state,
          route:
            routeState(),
          styleInstalled:
            Boolean(
              document.getElementById(
                STYLE_ID
              )
            ),
          currentRoot:
            workspaceRoot(
              routeState()
                .finance
            )?.className
            || null,
        }),
    };

  window.addEventListener(
    'hashchange',
    schedule,
    {
      passive: true,
    }
  );

  window.addEventListener(
    'pageshow',
    schedule,
    {
      passive: true,
    }
  );

  window.addEventListener(
    'focus',
    schedule,
    {
      passive: true,
    }
  );

  document.addEventListener(
    'change',
    (
      event
    ) => {
      if (
        !isFinance()
        || !(
          event.target
          instanceof Element
        )
      ) {
        return;
      }

      const root =
        workspaceRoot(
          routeState()
            .finance
        );

      if (
        root
        && root.contains(
          event.target
        )
      ) {
        requestCache.clear();
        schedule();
      }
    },
    {
      passive: true,
    }
  );

  window
    .__AQUILA_FINANCE_VISUAL_POLISH_R2_6_INSTALLED__ =
    true;

  ensureStyle();

  if (
    document.readyState
    === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      schedule,
      {
        once: true,
      }
    );
  } else {
    schedule();
  }
}());

/* AQUILA_FINANCE_R2_7 */
(function () {
  'use strict';

  if (
    window
      .__AQUILA_FINANCE_R2_7_INSTALLED__
  ) {
    return;
  }

  const RELEASE =
    'AQUILA_FINANCE_R2_7';

  const STYLE_ID =
    'aquila-finance-r2-7-style';

  const currentRuntimePath = (() => {
    try {
      return new URL(
        document.currentScript?.src
        || '',
        window.location.href,
      ).pathname;
    } catch {
      return '';
    }
  })();

  const state = {
    release: RELEASE,

    runs: 0,

    workspace:
      null,

    chartTargets:
      0,

    chartPoints:
      0,

    chartValueLabels:
      0,

    chartDateLabels:
      0,

    chartHorizontalScroll:
      0,

    overviewGranularity:
      'monthly',

    detailGranularity:
      'daily',

    recentRows:
      0,

    receivableRows:
      0,

    oldFinanceCacheEntriesRemoved:
      0,

    legacyDeckNodesRemoved:
      0,

    deckTopLocked:
      false,

    lastAppliedAt:
      null,

    lastError:
      null,
  };

  let generation = 0;

  const requestCache =
    new Map();

  const q = (
    selector,
    root = document,
  ) =>
    root?.querySelector?.(
      selector,
    )
    || null;

  const qa = (
    selector,
    root = document,
  ) =>
    root?.querySelectorAll
      ? [
          ...root.querySelectorAll(
            selector,
          ),
        ]
      : [];

  const normalize = (
    value,
  ) =>
    String(
      value ?? '',
    )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim()
      .toLowerCase();

  const numberValue = (
    value,
  ) => {
    if (
      value === null
      || value === undefined
      || value === ''
    ) {
      return null;
    }

    const parsed =
      Number(
        String(
          value,
        ).replace(
          /,/g,
          '',
        ),
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  };

  const firstNumber = (
    row,
    keys,
  ) => {
    for (
      const key
      of keys
    ) {
      const value =
        numberValue(
          row?.[key],
        );

      if (
        value !== null
      ) {
        return value;
      }
    }

    return null;
  };

  function deepValue(
    object,
    path,
  ) {
    return String(
      path,
    )
      .split(
        '.',
      )
      .reduce(
        (
          value,
          key,
        ) =>
          value
          && typeof value
            === 'object'
            ? value[key]
            : undefined,
        object,
      );
  }

  function firstValue(
    row,
    paths,
  ) {
    for (
      const path
      of paths
    ) {
      const value =
        deepValue(
          row,
          path,
        );

      if (
        value !== null
        && value !== undefined
        && String(
          value,
        ).trim() !== ''
      ) {
        return value;
      }
    }

    return null;
  }

  function parseMetadata(
    row,
  ) {
    const raw =
      row?.metadata;

    if (
      raw
      && typeof raw
        === 'object'
    ) {
      return raw;
    }

    if (
      typeof raw
      === 'string'
      && raw.trim()
    ) {
      try {
        return JSON.parse(
          raw,
        );
      } catch {
        return {};
      }
    }

    return {};
  }

  function ensureStyle() {
    if (
      document.getElementById(
        STYLE_ID,
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style',
      );

    style.id =
      STYLE_ID;

    style.textContent = `

/* ============================================================
   AQUILA FINANCE R2.7
   ============================================================ */

/* ------------------------------------------------------------
   ACTUAL APPROVED WORKSPACE DECK OWNER.
   Never place the Deck at the bottom.
   ------------------------------------------------------------ */
html body .ubuzima-glass-workspace-dock,
html body [data-ubuzima-workspace-dock] {
  position: fixed !important;

  top: 10px !important;
  bottom: auto !important;

  left: 50% !important;
  right: auto !important;

  width: fit-content !important;
  max-width: calc(100vw - 16px) !important;

  margin: 0 !important;

  transform: translateX(-50%) !important;

  translate: none !important;
  scale: 1 !important;

  z-index: 2147482000 !important;
}

@media (max-width: 767px) {
  html body .ubuzima-glass-workspace-dock,
  html body [data-ubuzima-workspace-dock] {
    top: 6px !important;
    bottom: auto !important;

    left: 50% !important;
    right: auto !important;

    width: fit-content !important;
    max-width: calc(100vw - 8px) !important;

    transform: translateX(-50%) !important;

    translate: none !important;
    scale: 1 !important;
  }
}

/* Known retired/legacy bottom remnants. */
.dock-remnant,
.deck-remnant,
.deck-menu-remnant,
.dock-menu-remnant,
.bottom-dock-remnant,
.bottom-dock-ghost,
.bottom-dock-placeholder,
.deck-menu-placeholder,
.deck-placeholder-ghost,
.workspace-bottom-remnant,
.module-bottom-remnant {
  display: none !important;

  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;

  margin: 0 !important;
  padding: 0 !important;

  overflow: hidden !important;
}

/* ------------------------------------------------------------
   FINANCE CHARTS.
   ------------------------------------------------------------ */
.aquila-finance-r2-7-chart-target {
  min-width: 0 !important;
}

.aquila-finance-r2-7-chart-host {
  position: relative !important;

  width: 100% !important;

  overflow-x: auto !important;
  overflow-y: hidden !important;

  overscroll-behavior-x: contain !important;

  scrollbar-gutter: stable !important;

  padding-bottom: 2px !important;
}

.aquila-finance-r2-7-chart-target
  [data-aquila-finance-r2-6-overlay],
.aquila-finance-r2-7-chart-target
  [data-aquila-finance-r2-5-series],
.aquila-finance-r2-7-chart-target
  [data-aquila-finance-data-label] {
  display: none !important;
}

.aquila-finance-r2-7-chart-host
  > svg:not([data-aquila-finance-r2-7-chart]) {
  display: none !important;
}

[data-aquila-finance-r2-7-chart] {
  display: block !important;

  overflow: visible !important;

  background: transparent !important;
}

/* Black data-label background + white text. */
[data-aquila-finance-r2-7-chart]
  .aquila-finance-r2-7-label-bg {
  fill: #000000 !important;
  stroke: #000000 !important;
  stroke-width: 1 !important;
}

[data-aquila-finance-r2-7-chart]
  .aquila-finance-r2-7-label-text {
  fill: #ffffff !important;

  font-family: inherit !important;
  font-size: 10px !important;
  font-weight: 800 !important;

  pointer-events: none !important;
}

/* X-axis dates. */
[data-aquila-finance-r2-7-chart]
  .aquila-finance-r2-7-date {
  fill: #475569 !important;

  font-family: inherit !important;
  font-size: 10px !important;
  font-weight: 700 !important;
}

/* There are intentionally no background grid lines in R2.7. */

/* ------------------------------------------------------------
   RECENT TRANSACTIONS.
   Five rows visible by default, additional rows vertically scroll.
   ------------------------------------------------------------ */
table[data-aquila-finance-r2-7-recent] {
  width: 100% !important;

  min-width: 0 !important;

  table-layout: fixed !important;
}

table[data-aquila-finance-r2-7-recent]
  thead,
table[data-aquila-finance-r2-7-recent]
  tbody
  tr {
  display: table !important;

  width: 100% !important;

  table-layout: fixed !important;
}

table[data-aquila-finance-r2-7-recent]
  tbody {
  display: block !important;

  width: 100% !important;

  max-height: 258px !important;

  overflow-y: auto !important;
  overflow-x: hidden !important;

  scrollbar-gutter: stable !important;
}

table[data-aquila-finance-r2-7-recent]
  th,
table[data-aquila-finance-r2-7-recent]
  td {
  box-sizing: border-box !important;

  white-space: nowrap !important;

  overflow: hidden !important;

  text-overflow: ellipsis !important;

  vertical-align: middle !important;
}

/* Date */
table[data-aquila-finance-r2-7-recent]
  th:nth-child(1),
table[data-aquila-finance-r2-7-recent]
  td:nth-child(1) {
  width: 12% !important;
}

/* Type */
table[data-aquila-finance-r2-7-recent]
  th:nth-child(2),
table[data-aquila-finance-r2-7-recent]
  td:nth-child(2) {
  width: 9% !important;
}

/* Description */
table[data-aquila-finance-r2-7-recent]
  th:nth-child(3),
table[data-aquila-finance-r2-7-recent]
  td:nth-child(3) {
  width: 35% !important;
}

/* Account */
table[data-aquila-finance-r2-7-recent]
  th:nth-child(4),
table[data-aquila-finance-r2-7-recent]
  td:nth-child(4) {
  width: 11% !important;
}

/* Amount */
table[data-aquila-finance-r2-7-recent]
  th:nth-child(5),
table[data-aquila-finance-r2-7-recent]
  td:nth-child(5) {
  width: 18% !important;
}

/* Status — must remain visible. */
table[data-aquila-finance-r2-7-recent]
  th:nth-child(6),
table[data-aquila-finance-r2-7-recent]
  td:nth-child(6) {
  width: 15% !important;
}

/* ------------------------------------------------------------
   TOP RECEIVABLES.
   Insurer | Customer | Outstanding | Ageing (Days)
   Five rows visible, additional rows vertically scroll.
   ------------------------------------------------------------ */
table[data-aquila-finance-r2-7-receivables] {
  width: 100% !important;

  min-width: 0 !important;

  table-layout: fixed !important;
}

table[data-aquila-finance-r2-7-receivables]
  thead,
table[data-aquila-finance-r2-7-receivables]
  tbody
  tr {
  display: table !important;

  width: 100% !important;

  table-layout: fixed !important;
}

table[data-aquila-finance-r2-7-receivables]
  tbody {
  display: block !important;

  width: 100% !important;

  max-height: 258px !important;

  overflow-y: auto !important;
  overflow-x: hidden !important;

  scrollbar-gutter: stable !important;
}

table[data-aquila-finance-r2-7-receivables]
  th,
table[data-aquila-finance-r2-7-receivables]
  td {
  box-sizing: border-box !important;

  white-space: nowrap !important;

  overflow: hidden !important;

  text-overflow: ellipsis !important;
}

/* Insurer */
table[data-aquila-finance-r2-7-receivables]
  th:nth-child(1),
table[data-aquila-finance-r2-7-receivables]
  td:nth-child(1) {
  width: 26% !important;
}

/* Customer */
table[data-aquila-finance-r2-7-receivables]
  th:nth-child(2),
table[data-aquila-finance-r2-7-receivables]
  td:nth-child(2) {
  width: 30% !important;
}

/* Outstanding */
table[data-aquila-finance-r2-7-receivables]
  th:nth-child(3),
table[data-aquila-finance-r2-7-receivables]
  td:nth-child(3) {
  width: 25% !important;
}

/* Ageing */
table[data-aquila-finance-r2-7-receivables]
  th:nth-child(4),
table[data-aquila-finance-r2-7-receivables]
  td:nth-child(4) {
  width: 19% !important;
}

`;

    document.head
      .appendChild(
        style,
      );
  }


  /* ============================================================
     DECK STABILITY
     ============================================================ */

  function removeLegacyDeckNodes() {
    const selectors = [
      '#ubuzimaSourceDockV5',
      '#ubuzimaSourceDock',

      '.ubuzima-source-dock',

      '[data-source-dock]',

      '#ubuzima-desktop-dock',
      '.ubuzima-desktop-dock',
      '[data-ubuzima-desktop-dock]',

      '.dock-remnant',
      '.deck-remnant',
      '.deck-menu-remnant',
      '.dock-menu-remnant',

      '.bottom-dock-remnant',
      '.bottom-dock-ghost',
      '.bottom-dock-placeholder',

      '.deck-menu-placeholder',
      '.deck-placeholder-ghost',

      '.workspace-bottom-remnant',
      '.module-bottom-remnant',
    ];

    let removed = 0;

    qa(
      selectors.join(
        ',',
      ),
    ).forEach(
      (
        element,
      ) => {
        if (
          element.matches(
            '.ubuzima-glass-workspace-dock,'
            + '[data-ubuzima-workspace-dock]',
          )
        ) {
          return;
        }

        if (
          element.querySelector(
            '.ubuzima-glass-workspace-dock,'
            + '[data-ubuzima-workspace-dock]',
          )
        ) {
          return;
        }

        element.remove();

        removed += 1;
      },
    );

    state.legacyDeckNodesRemoved +=
      removed;

    const dock =
      q(
        '.ubuzima-glass-workspace-dock,'
        + '[data-ubuzima-workspace-dock]',
      );

    if (
      dock
    ) {
      state.deckTopLocked =
        true;

      dock.setAttribute(
        'data-aquila-deck-top-lock',
        'R2.7',
      );
    }

    return removed;
  }


  async function clearRetiredFinanceCacheEntries() {
    if (
      !(
        'caches'
        in window
      )
    ) {
      return;
    }

    try {
      const names =
        await caches.keys();

      for (
        const name
        of names
      ) {
        const cache =
          await caches.open(
            name,
          );

        const requests =
          await cache.keys();

        for (
          const request
          of requests
        ) {
          let pathname = '';

          try {
            pathname =
              new URL(
                request.url,
              ).pathname;
          } catch {
            continue;
          }

          if (
            !/\/runtime-extensions\/finance-existing-ui-live-data-r[^/]*\.js$/i
              .test(
                pathname,
              )
          ) {
            continue;
          }

          if (
            currentRuntimePath
            && pathname
              === currentRuntimePath
          ) {
            continue;
          }

          const deleted =
            await cache.delete(
              request,
            );

          if (
            deleted
          ) {
            state
              .oldFinanceCacheEntriesRemoved
              += 1;
          }
        }
      }
    } catch {
      /* Cache cleanup is best effort and Finance-scoped only. */
    }
  }


  /* ============================================================
     ROUTE / AUTH / DATE HELPERS
     ============================================================ */

  function routeState() {
    const params =
      new URLSearchParams(
        window.location.hash
          .replace(
            /^#/,
            '',
          ),
      );

    return {
      section:
        params.get(
          'section',
        ),

      finance:
        params.get(
          'finance',
        )
        || 'overview',
    };
  }


  function isFinance() {
    return (
      routeState()
        .section
      === 'finance'
    );
  }


  function workspaceRoot(
    workspace,
  ) {
    switch (
      workspace
    ) {
      case 'overview':
        return q(
          '.finance-reference-v1',
        );

      case 'financial-statements':
        return q(
          '.profit-loss-v1',
        );

      case 'cash-flow':
        return q(
          '.cash-flow-v1',
        );

      case 'sales':
        return q(
          '.finance-sales-v1',
        );

      default:
        return null;
    }
  }


  function authContext() {
    const stores = [
      window.localStorage,
      window.sessionStorage,
    ];

    for (
      const store
      of stores
    ) {
      let raw = '';

      try {
        raw =
          store.getItem(
            'ubuzima_admin_session',
          )
          || '';
      } catch {
        raw = '';
      }

      if (
        !raw
      ) {
        continue;
      }

      try {
        const parsed =
          JSON.parse(
            raw,
          );

        const session =
          parsed.session
          || parsed;

        const profile =
          session.profile
          || parsed.profile
          || session.user?.profile
          || parsed.user?.profile
          || session.user
          || parsed.user
          || {};

        const assignment =
          profile
            .tenant_assignments?.[0]
            ?.tenant;

        const tenant =
          (
            typeof assignment
            === 'string'
              ? assignment
              : assignment?.slug
          )
          || profile.tenant?.slug
          || session.tenant?.slug
          || parsed.tenant?.slug
          || profile.scope?.tenant_slug
          || session.tenant_slug
          || parsed.tenant_slug
          || '';

        const token =
          session.token
          || session.access_token
          || parsed.token
          || parsed.access_token
          || '';

        if (
          token
          && tenant
        ) {
          return {
            token,
            tenant,
          };
        }
      } catch {
        /* Continue to the next available store. */
      }
    }

    return null;
  }


  function fallbackRange() {
    const today =
      new Date();

    const from =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      );

    const iso = (
      date,
    ) => [
      date.getFullYear(),

      String(
        date.getMonth()
        + 1,
      ).padStart(
        2,
        '0',
      ),

      String(
        date.getDate(),
      ).padStart(
        2,
        '0',
      ),
    ].join(
      '-',
    );

    return {
      from:
        iso(
          from,
        ),

      to:
        iso(
          today,
        ),
    };
  }


  function rangeFromDom(
    root,
  ) {
    const fallback =
      fallbackRange();

    if (
      !root
    ) {
      return fallback;
    }

    const dates =
      qa(
        'input[type="date"]',
        root,
      )
        .map(
          (
            input,
          ) =>
            String(
              input.value
              || '',
            ).trim(),
        )
        .filter(
          (
            value,
          ) =>
            /^\d{4}-\d{2}-\d{2}$/
              .test(
                value,
              ),
        );

    if (
      dates.length >= 2
    ) {
      return {
        from:
          dates[0],

        to:
          dates[1],
      };
    }

    if (
      dates.length === 1
    ) {
      return {
        from:
          fallback.from,

        to:
          dates[0],
      };
    }

    return fallback;
  }


  /* ============================================================
     READ REQUESTS
     ============================================================ */

  async function getJson(
    url,
    auth,
  ) {
    const key =
      auth.tenant
      + '|'
      + url;

    const cached =
      requestCache.get(
        key,
      );

    if (
      cached
      && (
        Date.now()
        - cached.time
      ) < 15000
    ) {
      return cached.value;
    }

    const promise =
      fetch(
        url,
        {
          method:
            'GET',

          credentials:
            'same-origin',

          cache:
            'no-store',

          headers: {
            Accept:
              'application/json',

            Authorization:
              'Bearer '
              + auth.token,

            'X-Tenant-Slug':
              auth.tenant,
          },
        },
      )
        .then(
          async (
            response,
          ) => ({
            ok:
              response.ok,

            status:
              response.status,

            payload:
              await response
                .json()
                .catch(
                  () => ({}),
                ),
          }),
        )
        .catch(
          (
            error,
          ) => ({
            ok:
              false,

            status:
              0,

            payload:
              {},

            error:
              String(
                error?.message
                ?? error,
              ),
          }),
        );

    requestCache.set(
      key,
      {
        time:
          Date.now(),

        value:
          promise,
      },
    );

    return promise;
  }


  function endpointUrl(
    endpoint,
    range,
    perPage = 400,
  ) {
    const url =
      new URL(
        '/api/v1/pharmaco/finance/commercial/'
        + endpoint,
        window.location.origin,
      );

    url.searchParams.set(
      'from',
      range.from,
    );

    url.searchParams.set(
      'to',
      range.to,
    );

    url.searchParams.set(
      'page',
      '1',
    );

    url.searchParams.set(
      'per_page',
      String(
        perPage,
      ),
    );

    return (
      url.pathname
      + url.search
    );
  }


  function unwrap(
    payload,
  ) {
    let value =
      payload;

    for (
      let index = 0;
      index < 4;
      index += 1
    ) {
      if (
        value
        && !Array.isArray(
          value,
        )
        && typeof value
          === 'object'
        && value.data
          !== undefined
        && !value.rows
        && !value.series
        && !value.summary
      ) {
        value =
          value.data;

        continue;
      }

      break;
    }

    return value;
  }


  function rowsFrom(
    payload,
  ) {
    const value =
      unwrap(
        payload,
      );

    if (
      Array.isArray(
        value,
      )
    ) {
      return value;
    }

    if (
      !value
      || typeof value
        !== 'object'
    ) {
      return [];
    }

    const candidates = [
      value.rows,
      value.records,
      value.items,
      value.sales,
      value.receivables,
      value.transactions,
      value.data,
      value.data?.data,
      payload?.data?.rows,
      payload?.data?.data,
    ];

    for (
      const candidate
      of candidates
    ) {
      if (
        Array.isArray(
          candidate,
        )
      ) {
        return candidate;
      }
    }

    return [];
  }


  function seriesFrom(
    payload,
  ) {
    const value =
      unwrap(
        payload,
      );

    if (
      !value
      || typeof value
        !== 'object'
    ) {
      return [];
    }

    const candidates = [
      value.series,
      value.trend,
      value.timeline,
      value.data?.series,
      payload?.data?.series,
    ];

    for (
      const candidate
      of candidates
    ) {
      if (
        Array.isArray(
          candidate,
        )
      ) {
        return [
          ...candidate,
        ].sort(
          (
            left,
            right,
          ) =>
            String(
              rowDate(
                left,
              ),
            ).localeCompare(
              String(
                rowDate(
                  right,
                ),
              ),
            ),
        );
      }
    }

    return [];
  }


  function rowDate(
    row,
  ) {
    return String(
      firstValue(
        row,
        [
          'business_date',
          'label',
          'date',
          'posting_date',
          'sold_at',
          'received_at',
          'created_at',
        ],
      )
      || '',
    ).slice(
      0,
      10,
    );
  }


  /* ============================================================
     CHART VALUES / GRANULARITY
     ============================================================ */

  function primaryValue(
    row,
  ) {
    return firstNumber(
      row,
      [
        'primary',
        'income',
        'revenue',
        'sales',
        'cash_in',
        'cash_inflow',
        'inflow',
        'receipts',
        'value',
      ],
    );
  }


  function secondaryValue(
    row,
  ) {
    return firstNumber(
      row,
      [
        'secondary',
        'expenses',
        'expense',
        'returns',
        'cash_out',
        'cash_outflow',
        'outflow',
        'payments',
      ],
    );
  }


  function pnlNet(
    row,
  ) {
    const explicit =
      firstNumber(
        row,
        [
          'net_profit',
          'net_income',
          'net',
          'tertiary',
        ],
      );

    if (
      explicit !== null
    ) {
      return explicit;
    }

    const income =
      primaryValue(
        row,
      );

    const expense =
      secondaryValue(
        row,
      );

    if (
      income === null
      || expense === null
    ) {
      return null;
    }

    return (
      income
      - expense
    );
  }


  function cashNet(
    row,
  ) {
    const explicit =
      firstNumber(
        row,
        [
          'net_cash_flow',
          'net_cash',
          'net_flow',
          'net',
          'tertiary',
        ],
      );

    if (
      explicit !== null
    ) {
      return explicit;
    }

    const inflow =
      primaryValue(
        row,
      );

    const outflow =
      secondaryValue(
        row,
      );

    if (
      inflow === null
    ) {
      return null;
    }

    return (
      inflow
      - (
        outflow
        ?? 0
      )
    );
  }


  function aggregateMonthly(
    series,
  ) {
    const groups =
      new Map();

    series.forEach(
      (
        row,
      ) => {
        const date =
          rowDate(
            row,
          );

        if (
          !/^\d{4}-\d{2}-\d{2}$/
            .test(
              date,
            )
        ) {
          return;
        }

        const month =
          date.slice(
            0,
            7,
          );

        if (
          !groups.has(
            month,
          )
        ) {
          groups.set(
            month,
            {
              business_date:
                month
                + '-01',

              primary:
                0,

              secondary:
                0,

              primary_present:
                false,

              secondary_present:
                false,
            },
          );
        }

        const group =
          groups.get(
            month,
          );

        const primary =
          primaryValue(
            row,
          );

        const secondary =
          secondaryValue(
            row,
          );

        if (
          primary !== null
        ) {
          group.primary +=
            primary;

          group.primary_present =
            true;
        }

        if (
          secondary !== null
        ) {
          group.secondary +=
            secondary;

          group.secondary_present =
            true;
        }
      },
    );

    return [
      ...groups.values(),
    ]
      .map(
        (
          row,
        ) => ({
          business_date:
            row.business_date,

          primary:
            row.primary_present
              ? row.primary
              : null,

          secondary:
            row.secondary_present
              ? row.secondary
              : null,
        }),
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.business_date
            .localeCompare(
              right.business_date,
            ),
      );
  }


  function compactNumber(
    raw,
  ) {
    const value =
      numberValue(
        raw,
      );

    if (
      value === null
    ) {
      return '';
    }

    const absolute =
      Math.abs(
        value,
      );

    if (
      absolute >= 1000000000
    ) {
      return (
        value
        / 1000000000
      ).toFixed(
        1,
      )
        .replace(
          /\.0$/,
          '',
        )
        + 'B';
    }

    if (
      absolute >= 1000000
    ) {
      return (
        value
        / 1000000
      ).toFixed(
        1,
      )
        .replace(
          /\.0$/,
          '',
        )
        + 'M';
    }

    if (
      absolute >= 1000
    ) {
      return (
        value
        / 1000
      ).toFixed(
        1,
      )
        .replace(
          /\.0$/,
          '',
        )
        + 'K';
    }

    return Math.round(
      value,
    ).toLocaleString(
      'en-US',
    );
  }


  function dailyLabel(
    raw,
  ) {
    const value =
      String(
        raw
        || '',
      ).slice(
        0,
        10,
      );

    const parts =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

    if (
      !parts
    ) {
      return value;
    }

    const date =
      new Date(
        Number(
          parts[1],
        ),
        Number(
          parts[2],
        ) - 1,
        Number(
          parts[3],
        ),
      );

    return new Intl
      .DateTimeFormat(
        'en-GB',
        {
          day:
            '2-digit',

          month:
            'short',
        },
      )
      .format(
        date,
      );
  }


  function monthlyLabel(
    raw,
  ) {
    const value =
      String(
        raw
        || '',
      ).slice(
        0,
        10,
      );

    const parts =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

    if (
      !parts
    ) {
      return value;
    }

    const date =
      new Date(
        Number(
          parts[1],
        ),
        Number(
          parts[2],
        ) - 1,
        1,
      );

    return new Intl
      .DateTimeFormat(
        'en-GB',
        {
          month:
            'short',

          year:
            'numeric',
        },
      )
      .format(
        date,
      );
  }


  /* ============================================================
     CHART DOM
     ============================================================ */

  function findPanelByTitle(
    root,
    title,
  ) {
    if (
      !root
    ) {
      return null;
    }

    const wanted =
      normalize(
        title,
      );

    const headings =
      qa(
        'h1,h2,h3,h4,h5,h6,strong,b',
        root,
      );

    let heading =
      headings.find(
        (
          element,
        ) =>
          normalize(
            element.textContent,
          ) === wanted,
      );

    if (
      !heading
    ) {
      heading =
        headings.find(
          (
            element,
          ) =>
            normalize(
              element.textContent,
            ).includes(
              wanted,
            ),
        );
    }

    if (
      !heading
    ) {
      return null;
    }

    for (
      const candidate
      of [
        heading.closest(
          'article',
        ),

        heading.closest(
          '[class*="panel"]',
        ),

        heading.closest(
          '[class*="chart"]',
        ),

        heading.parentElement
          ?.parentElement,
      ]
    ) {
      if (
        candidate
        && candidate !== root
        && root.contains(
          candidate,
        )
      ) {
        return candidate;
      }
    }

    return null;
  }


  function svgArea(
    svg,
  ) {
    const box =
      svg?.getBoundingClientRect?.();

    return (
      (
        box?.width
        || 0
      )
      * (
        box?.height
        || 0
      )
    );
  }


  function chartHost(
    panel,
  ) {
    const nativeSvg =
      qa(
        'svg',
        panel,
      )
        .filter(
          (
            svg,
          ) =>
            !svg.closest(
              'button',
            ),
        )
        .sort(
          (
            left,
            right,
          ) =>
            svgArea(
              right,
            )
            - svgArea(
              left,
            ),
        )[0]
      || null;

    if (
      nativeSvg
      && nativeSvg.parentElement
    ) {
      return nativeSvg
        .parentElement;
    }

    return (
      q(
        '[class*="chart"]',
        panel,
      )
      || panel
    );
  }


  function createSvg(
    name,
    attributes = {},
  ) {
    const element =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        name,
      );

    Object.entries(
      attributes,
    ).forEach(
      (
        [
          key,
          value,
        ],
      ) => {
        element.setAttribute(
          key,
          String(
            value,
          ),
        );
      },
    );

    return element;
  }


  function renderChart(
    panel,
    inputSeries,
    definitions,
    granularity,
  ) {
    if (
      !panel
      || !inputSeries.length
      || !definitions.length
    ) {
      return false;
    }

    let series =
      inputSeries;

    if (
      granularity === 'monthly'
    ) {
      series =
        aggregateMonthly(
          inputSeries,
        );
    }

    if (
      !series.length
    ) {
      return false;
    }

    const host =
      chartHost(
        panel,
      );

    if (
      !host
    ) {
      return false;
    }

    panel.classList.add(
      'aquila-finance-r2-7-chart-target',
    );

    host.classList.add(
      'aquila-finance-r2-7-chart-host',
    );

    const previousScrollLeft =
      host.scrollLeft;

    Array.from(
  host.querySelectorAll(
    '[data-aquila-finance-r2-7-canvas]'
  )
).forEach(
  element => element.remove()
);

    const prepared =
      definitions
        .map(
          (
            definition,
          ) => ({
            ...definition,

            values:
              series.map(
                (
                  row,
                  index,
                ) =>
                  numberValue(
                    definition.value(
                      row,
                      index,
                    ),
                  ),
              ),
          }),
        )
        .filter(
          (
            definition,
          ) =>
            definition.values
              .some(
                (
                  value,
                ) =>
                  value !== null,
              ),
        );

    if (
      !prepared.length
    ) {
      return false;
    }

    const pointWidth =
      granularity === 'monthly'
        ? 128
        : 78;

    const visibleWidth =
      Math.max(
        560,
        Math.round(
          host.getBoundingClientRect()
            .width
          || 0,
        ),
      );

    const width =
      Math.max(
        visibleWidth,
        66
        + series.length
        * pointWidth,
      );

    const height =
      238;

    const left =
      34;

    const right =
      28;

    const top =
      28;

    const bottom =
      40;

    const plotWidth =
      width
      - left
      - right;

    const plotHeight =
      height
      - top
      - bottom;

    const allValues =
      prepared
        .flatMap(
          (
            definition,
          ) =>
            definition.values,
        )
        .filter(
          (
            value,
          ) =>
            value !== null,
        );

    let minimum =
      Math.min(
        0,
        ...allValues,
      );

    let maximum =
      Math.max(
        0,
        ...allValues,
      );

    if (
      maximum === minimum
    ) {
      maximum =
        minimum
        + 1;
    }

    const padding =
      Math.max(
        1,
        (
          maximum
          - minimum
        ) * 0.08,
      );

    maximum +=
      padding;

    if (
      minimum < 0
    ) {
      minimum -=
        padding;
    }

    const x = (
      index,
    ) =>
      series.length === 1
        ? left
          + plotWidth / 2
        : left
          + index
          * plotWidth
          / (
            series.length
            - 1
          );

    const y = (
      value,
    ) =>
      top
      + (
        maximum
        - value
      )
      / (
        maximum
        - minimum
      )
      * plotHeight;

    const canvas =
      document.createElement(
        'div',
      );

    canvas.setAttribute(
      'data-aquila-finance-r2-7-canvas',
      'true',
    );

    canvas.style.width =
      width
      + 'px';

    canvas.style.minWidth =
      width
      + 'px';

    canvas.style.height =
      height
      + 'px';

    canvas.style.position =
      'relative';

    const svg =
      createSvg(
        'svg',
        {
          width,
          height,

          viewBox:
            `0 0 ${width} ${height}`,

          'data-aquila-finance-r2-7-chart':
            'true',

          role:
            'img',
        },
      );

    const colours = [
      '#16a34a',
      '#dc2626',
      '#2563eb',
      '#7c3aed',
    ];

    prepared.forEach(
      (
        definition,
        seriesIndex,
      ) => {
        const colour =
          definition.colour
          || colours[
            seriesIndex
            % colours.length
          ];

        let segment = [];

        const flushSegment =
          () => {
            if (
              segment.length > 1
            ) {
              svg.appendChild(
                createSvg(
                  'polyline',
                  {
                    points:
                      segment.join(
                        ' ',
                      ),

                    fill:
                      'none',

                    stroke:
                      colour,

                    'stroke-width':
                      2.6,

                    'stroke-linecap':
                      'round',

                    'stroke-linejoin':
                      'round',
                  },
                ),
              );
            }

            segment = [];
          };

        definition.values.forEach(
          (
            value,
            index,
          ) => {
            if (
              value === null
            ) {
              flushSegment();
              return;
            }

            segment.push(
              `${x(index)},${y(value)}`,
            );
          },
        );

        flushSegment();

        definition.values.forEach(
          (
            value,
            index,
          ) => {
            if (
              value === null
            ) {
              return;
            }

            svg.appendChild(
              createSvg(
                'circle',
                {
                  cx:
                    x(index),

                  cy:
                    y(value),

                  r:
                    3.2,

                  fill:
                    colour,
                },
              ),
            );

            if (
              definition.hideZero
              && Math.abs(
                value,
              ) < 0.000001
            ) {
              return;
            }

            const text =
              compactNumber(
                value,
              );

            if (
              !text
            ) {
              return;
            }

            const widthBox =
              Math.max(
                32,
                text.length
                * 6.5
                + 12,
              );

            const heightBox =
              19;

            const seriesOffset =
              prepared.length === 1
                ? -15
                : seriesIndex === 0
                  ? -16
                  : 17
                    + (
                      seriesIndex
                      - 1
                    ) * 16;

            const labelX =
              x(
                index,
              );

            let labelY =
              y(
                value,
              )
              + seriesOffset;

            labelY =
              Math.max(
                13,
                Math.min(
                  height
                  - bottom
                  - 8,
                  labelY,
                ),
              );

            const group =
              createSvg(
                'g',
                {
                  'data-aquila-finance-r2-7-value':
                    'true',
                },
              );

            group.appendChild(
              createSvg(
                'rect',
                {
                  x:
                    labelX
                    - widthBox / 2,

                  y:
                    labelY
                    - 12,

                  width:
                    widthBox,

                  height:
                    heightBox,

                  rx:
                    4,

                  ry:
                    4,

                  class:
                    'aquila-finance-r2-7-label-bg',
                },
              ),
            );

            const valueText =
              createSvg(
                'text',
                {
                  x:
                    labelX,

                  y:
                    labelY
                    + 1,

                  'text-anchor':
                    'middle',

                  class:
                    'aquila-finance-r2-7-label-text',
                },
              );

            valueText.textContent =
              text;

            group.appendChild(
              valueText,
            );

            svg.appendChild(
              group,
            );

            state
              .chartValueLabels
              += 1;
          },
        );
      },
    );

    series.forEach(
      (
        row,
        index,
      ) => {
        const date =
          rowDate(
            row,
          );

        if (
          !date
        ) {
          return;
        }

        const text =
          createSvg(
            'text',
            {
              x:
                x(index),

              y:
                height - 9,

              'text-anchor':
                'middle',

              class:
                'aquila-finance-r2-7-date',
            },
          );

        text.textContent =
          granularity === 'monthly'
            ? monthlyLabel(
                date,
              )
            : dailyLabel(
                date,
              );

        svg.appendChild(
          text,
        );

        state
          .chartDateLabels
          += 1;
      },
    );

    canvas.appendChild(
      svg,
    );

    host.appendChild(
      canvas,
    );

    window.requestAnimationFrame(
      () => {
        host.scrollLeft =
          Math.min(
            previousScrollLeft,
            Math.max(
              0,
              host.scrollWidth
              - host.clientWidth,
            ),
          );
      },
    );

    if (
      width
      > visibleWidth
      + 2
    ) {
      state
        .chartHorizontalScroll
        += 1;
    }

    state.chartTargets +=
      1;

    state.chartPoints +=
      series.length;

    return true;
  }


  /* ============================================================
     TABLE HELPERS
     ============================================================ */

  function formatMoney(
    raw,
  ) {
    const value =
      numberValue(
        raw,
      );

    if (
      value === null
    ) {
      return '—';
    }

    return (
      'RWF '
      + new Intl
        .NumberFormat(
          'en-US',
          {
            maximumFractionDigits:
              0,
          },
        )
        .format(
          value,
        )
    );
  }


  function niceText(
    raw,
  ) {
    const value =
      String(
        raw
        ?? '',
      )
        .replace(
          /[_-]+/g,
          ' ',
        )
        .trim();

    if (
      !value
    ) {
      return '—';
    }

    return value
      .replace(
        /\b\w/g,
        (
          character,
        ) =>
          character
            .toUpperCase(),
      );
  }


  function dateText(
    raw,
  ) {
    const value =
      String(
        raw
        || '',
      ).slice(
        0,
        10,
      );

    return (
      value
      || '—'
    );
  }


  function recentValue(
    header,
    row,
  ) {
    if (
      header.includes(
        'date',
      )
    ) {
      return dateText(
        firstValue(
          row,
          [
            'business_date',
            'received_at',
            'paid_at',
            'posting_date',
            'created_at',
          ],
        ),
      );
    }

    if (
      header.includes(
        'type',
      )
    ) {
      return niceText(
        firstValue(
          row,
          [
            'transaction_type',
            'source_type',
            'type',
            'event_type',
            'payment_method',
          ],
        ),
      );
    }

    if (
      header.includes(
        'description',
      )
    ) {
      return (
        firstValue(
          row,
          [
            'description',
            'memo',
            'narration',
            'reference_number',
            'reference',
            'sale_number',
            'receipt_number',
          ],
        )
        || '—'
      );
    }

    if (
      header.includes(
        'account',
      )
    ) {
      return (
        firstValue(
          row,
          [
            'account_name',
            'account',
            'account_code',
            'payment_method',
            'channel',
            'method',
          ],
        )
        || '—'
      );
    }

    if (
      header.includes(
        'amount',
      )
    ) {
      return formatMoney(
        firstNumber(
          row,
          [
            'amount',
            'payment_amount',
            'paid_amount',
            'cash_in',
            'inflow',
            'credit',
            'debit',
          ],
        ),
      );
    }

    if (
      header.includes(
        'status',
      )
    ) {
      return niceText(
        firstValue(
          row,
          [
            'status',
            'payment_status',
            'reconciliation_status',
          ],
        ),
      );
    }

    return '—';
  }


  function renderRecentTransactions(
    root,
    sourceRows,
  ) {
    const panel =
      q(
        '.finance-reference-v1__panel--transactions',
        root,
      );

    const table =
      panel
      && q(
        'table',
        panel,
      );

    const body =
      table
      && q(
        'tbody',
        table,
      );

    const headers =
      table
        ? qa(
            'thead th',
            table,
          )
        : [];

    if (
      !table
      || !body
      || !headers.length
    ) {
      return 0;
    }

    table.setAttribute(
      'data-aquila-finance-r2-7-recent',
      'true',
    );

    const labels =
      headers.map(
        (
          header,
        ) =>
          normalize(
            header.textContent,
          ),
      );

    const fragment =
      document.createDocumentFragment();

    sourceRows.forEach(
      (
        row,
      ) => {
        const tr =
          document.createElement(
            'tr',
          );

        labels.forEach(
          (
            header,
            index,
          ) => {
            const td =
              document.createElement(
                'td',
              );

            const value =
              recentValue(
                header,
                row,
              );

            td.textContent =
              value;

            td.title =
              value;

            if (
              index === 2
            ) {
              td.setAttribute(
                'data-aquila-finance-r2-7-description',
                'true',
              );
            }

            tr.appendChild(
              td,
            );
          },
        );

        fragment.appendChild(
          tr,
        );
      },
    );

    if (
      !sourceRows.length
    ) {
      const tr =
        document.createElement(
          'tr',
        );

      const td =
        document.createElement(
          'td',
        );

      td.colSpan =
        Math.max(
          headers.length,
          1,
        );

      td.textContent =
        'No data available';

      tr.appendChild(
        td,
      );

      fragment.appendChild(
        tr,
      );
    }

    const previousScrollTop =
      body.scrollTop;

    body.replaceChildren(
      fragment,
    );

    body.scrollTop =
      previousScrollTop;

    state.recentRows =
      sourceRows.length;

    return sourceRows.length;
  }


  function insurerName(
    row,
  ) {
    const metadata =
      parseMetadata(
        row,
      );

    return (
      firstValue(
        row,
        [
          'insurer_name',
          'insurance_name',
          'insurance_partner_name',
          'insurance_provider_name',

          'insurer.name',
          'insurance.name',
          'insurance.partner_name',

          'payer.insurer_name',
          'payer.insurance_name',
        ],
      )

      || firstValue(
        metadata,
        [
          'insurance.partner_name',
          'insurance.insurer_name',
          'insurance.name',

          'insurance_partner_name',
          'insurer_name',
        ],
      )

      || '—'
    );
  }


  function customerName(
    row,
  ) {
    return (
      firstValue(
        row,
        [
          'customer_name',
          'transaction_customer_name',

          'customer.name',
          'customer.full_name',

          'patient_name',
          'member_name',
        ],
      )
      || '—'
    );
  }


  function outstandingValue(
    row,
  ) {
    return firstNumber(
      row,
      [
        'balance_amount',
        'outstanding',
        'outstanding_amount',
        'receivable_amount',
        'amount_due',
      ],
    );
  }


  function ageingDays(
    row,
    rangeEnd,
  ) {
    const explicit =
      firstNumber(
        row,
        [
          'ageing_days',
          'aging_days',
        ],
      );

    if (
      explicit !== null
    ) {
      return Math.max(
        0,
        Math.round(
          explicit,
        ),
      );
    }

    const base =
      String(
        firstValue(
          row,
          [
            'business_date',
            'sold_at',
            'issued_at',
            'created_at',
            'due_date',
          ],
        )
        || '',
      ).slice(
        0,
        10,
      );

    if (
      !/^\d{4}-\d{2}-\d{2}$/
        .test(
          base,
        )
      || !/^\d{4}-\d{2}-\d{2}$/
        .test(
          rangeEnd,
        )
    ) {
      return '—';
    }

    const start =
      new Date(
        base
        + 'T00:00:00',
      );

    const end =
      new Date(
        rangeEnd
        + 'T00:00:00',
      );

    const milliseconds =
      end.getTime()
      - start.getTime();

    if (
      !Number.isFinite(
        milliseconds,
      )
    ) {
      return '—';
    }

    return Math.max(
      0,
      Math.floor(
        milliseconds
        / 86400000,
      ),
    );
  }


  function renderReceivables(
    root,
    inputRows,
    range,
  ) {
    const panel =
      q(
        '.finance-reference-v1__panel--receivables',
        root,
      );

    const table =
      panel
      && q(
        'table',
        panel,
      );

    const head =
      table
      && q(
        'thead',
        table,
      );

    const body =
      table
      && q(
        'tbody',
        table,
      );

    if (
      !table
      || !head
      || !body
    ) {
      return 0;
    }

    table.setAttribute(
      'data-aquila-finance-r2-7-receivables',
      'true',
    );

    const headRow =
      document.createElement(
        'tr',
      );

    [
      'Insurer',
      'Customer',
      'Outstanding',
      'Ageing (Days)',
    ].forEach(
      (
        label,
      ) => {
        const th =
          document.createElement(
            'th',
          );

        th.textContent =
          label;

        headRow.appendChild(
          th,
        );
      },
    );

    head.replaceChildren(
      headRow,
    );

    const sorted =
      [
        ...inputRows,
      ].sort(
        (
          left,
          right,
        ) =>
          (
            outstandingValue(
              right,
            )
            || 0
          )
          - (
            outstandingValue(
              left,
            )
            || 0
          ),
      );

    const fragment =
      document.createDocumentFragment();

    sorted.forEach(
      (
        row,
      ) => {
        const values = [
          insurerName(
            row,
          ),

          customerName(
            row,
          ),

          formatMoney(
            outstandingValue(
              row,
            ),
          ),

          String(
            ageingDays(
              row,
              range.to,
            ),
          ),
        ];

        const tr =
          document.createElement(
            'tr',
          );

        values.forEach(
          (
            value,
          ) => {
            const td =
              document.createElement(
                'td',
              );

            td.textContent =
              value;

            td.title =
              value;

            tr.appendChild(
              td,
            );
          },
        );

        fragment.appendChild(
          tr,
        );
      },
    );

    if (
      !sorted.length
    ) {
      const tr =
        document.createElement(
          'tr',
        );

      const td =
        document.createElement(
          'td',
        );

      td.colSpan =
        4;

      td.textContent =
        'No data available';

      tr.appendChild(
        td,
      );

      fragment.appendChild(
        tr,
      );
    }

    const previousScrollTop =
      body.scrollTop;

    body.replaceChildren(
      fragment,
    );

    body.scrollTop =
      previousScrollTop;

    state.receivableRows =
      sorted.length;

    return sorted.length;
  }


  /* ============================================================
     SALES RETURNS
     ============================================================ */

  async function returnMap(
    range,
    auth,
  ) {
    const response =
      await getJson(
        '/api/v1/pharmaco/sales/returns',
        auth,
      );

    if (
      !response.ok
    ) {
      return null;
    }

    const rows =
      rowsFrom(
        response.payload,
      );

    const result =
      new Map();

    rows.forEach(
      (
        row,
      ) => {
        if (
          normalize(
            row?.status,
          )
          !== 'refunded'
        ) {
          return;
        }

        const date =
          String(
            firstValue(
              row,
              [
                'refunded_at',
                'approved_at',
                'requested_at',
                'created_at',
              ],
            )
            || '',
          ).slice(
            0,
            10,
          );

        if (
          !date
          || date < range.from
          || date > range.to
        ) {
          return;
        }

        const amount =
          firstNumber(
            row,
            [
              'approved_refund_amount',
              'requested_refund_amount',
              'refund_amount',
            ],
          );

        if (
          amount === null
        ) {
          return;
        }

        result.set(
          date,
          (
            result.get(
              date,
            )
            || 0
          )
          + amount,
        );
      },
    );

    return result;
  }


  /* ============================================================
     WORKSPACE PRESENTATION
     ============================================================ */

  async function applyOverview(
    root,
    range,
    auth,
  ) {
    const [
      overview,
      receivables,
      pnl,
      cash,
    ] =
      await Promise.all([
        getJson(
          endpointUrl(
            'overview',
            range,
          ),
          auth,
        ),

        getJson(
          endpointUrl(
            'receivables',
            range,
          ),
          auth,
        ),

        getJson(
          endpointUrl(
            'profit-loss',
            range,
          ),
          auth,
        ),

        getJson(
          endpointUrl(
            'cash-flow',
            range,
          ),
          auth,
        ),
      ]);

    if (
      overview.ok
    ) {
      renderRecentTransactions(
        root,
        rowsFrom(
          overview.payload,
        ),
      );
    }

    if (
      receivables.ok
    ) {
      renderReceivables(
        root,
        rowsFrom(
          receivables.payload,
        ),
        range,
      );
    }

    const revenuePanel =
      findPanelByTitle(
        root,
        'Revenue vs Expenses',
      )
      || findPanelByTitle(
        root,
        'Revenue vs Expenses Trend',
      )
      || q(
        '.finance-reference-v1__panel--revenue',
        root,
      );

    const cashPanel =
      findPanelByTitle(
        root,
        'Cash Flow Overview',
      )
      || q(
        '.finance-reference-v1__panel--cash-flow',
        root,
      );

    if (
      pnl.ok
      && revenuePanel
    ) {
      renderChart(
        revenuePanel,
        seriesFrom(
          pnl.payload,
        ),
        [
          {
            value:
              primaryValue,

            colour:
              '#16a34a',
          },
          {
            value:
              secondaryValue,

            colour:
              '#dc2626',
          },
        ],
        'monthly',
      );
    }

    if (
      cash.ok
      && cashPanel
    ) {
      renderChart(
        cashPanel,
        seriesFrom(
          cash.payload,
        ),
        [
          {
            value:
              primaryValue,

            colour:
              '#16a34a',
          },
          {
            value:
              secondaryValue,

            colour:
              '#dc2626',
          },
        ],
        'monthly',
      );
    }
  }


  async function applyProfitLoss(
    root,
    range,
    auth,
  ) {
    const response =
      await getJson(
        endpointUrl(
          'profit-loss',
          range,
        ),
        auth,
      );

    if (
      !response.ok
    ) {
      return;
    }

    const series =
      seriesFrom(
        response.payload,
      );

    const incomePanel =
      findPanelByTitle(
        root,
        'Income vs Expenses',
      );

    const netPanel =
      findPanelByTitle(
        root,
        'Net Profit Trend',
      );

    if (
      incomePanel
    ) {
      renderChart(
        incomePanel,
        series,
        [
          {
            value:
              primaryValue,

            colour:
              '#16a34a',
          },
          {
            value:
              secondaryValue,

            colour:
              '#dc2626',
          },
        ],
        'daily',
      );
    }

    if (
      netPanel
    ) {
      renderChart(
        netPanel,
        series,
        [
          {
            value:
              pnlNet,

            colour:
              '#2563eb',
          },
        ],
        'daily',
      );
    }
  }


  async function applyCashFlow(
    root,
    range,
    auth,
  ) {
    const response =
      await getJson(
        endpointUrl(
          'cash-flow',
          range,
        ),
        auth,
      );

    if (
      !response.ok
    ) {
      return;
    }

    const series =
      seriesFrom(
        response.payload,
      );

    const comparisonPanel =
      findPanelByTitle(
        root,
        'Cash Inflow vs Cash Outflow',
      );

    const netPanel =
      findPanelByTitle(
        root,
        'Net Cash Flow Trend',
      );

    if (
      comparisonPanel
    ) {
      renderChart(
        comparisonPanel,
        series,
        [
          {
            value:
              primaryValue,

            colour:
              '#16a34a',
          },
          {
            value:
              secondaryValue,

            colour:
              '#dc2626',
          },
        ],
        'daily',
      );
    }

    if (
      netPanel
    ) {
      renderChart(
        netPanel,
        series,
        [
          {
            value:
              cashNet,

            colour:
              '#2563eb',
          },
        ],
        'daily',
      );
    }
  }



  async function applySales(
    root,
    range,
    auth,
  ) {
    const [
      response,
      refunds,
    ] =
      await Promise.all([
        getJson(
          endpointUrl(
            'sales',
            range,
          ),
          auth,
        ),

        returnMap(
          range,
          auth,
        ),
      ]);

    if (
      !response.ok
    ) {
      return;
    }

    const series =
      seriesFrom(
        response.payload,
      );

    const salesPanel =
      findPanelByTitle(
        root,
        'Sales vs Returns',
      );

    const revenuePanel =
      findPanelByTitle(
        root,
        'Revenue Trend',
      );

    const definitions = [
      {
        value:
          primaryValue,

        colour:
          '#16a34a',
      },
    ];

    if (
      refunds
    ) {
      definitions.push(
        {
          value:
            (
              row,
            ) =>
              refunds.get(
                rowDate(
                  row,
                ),
              )
              || 0,

          colour:
            '#dc2626',

          hideZero:
            true,
        },
      );
    }

    if (
      salesPanel
    ) {
      renderChart(
        salesPanel,
        series,
        definitions,
        'daily',
      );
    }

    if (
      revenuePanel
    ) {
      renderChart(
        revenuePanel,
        series,
        [
          {
            value:
              primaryValue,

            colour:
              '#2563eb',
          },
        ],
        'daily',
      );
    }
  

}


  /* ============================================================
     APPLY / LIFECYCLE
     ============================================================ */

  async function apply() {
    ensureStyle();

    removeLegacyDeckNodes();

    if (
      !isFinance()
    ) {
      return false;
    }

    state.runs += 1;

    state.chartTargets =
      0;

    state.chartPoints =
      0;

    state.chartValueLabels =
      0;

    state.chartDateLabels =
      0;

    state.chartHorizontalScroll =
      0;

    state.lastError =
      null;

    const route =
      routeState();

    state.workspace =
      route.finance;

    const root =
      workspaceRoot(
        route.finance,
      );

    if (
      !root
    ) {
      state.lastError =
        'Finance workspace root is not mounted yet.';

      return false;
    }

    const auth =
      authContext();

    if (
      !auth
    ) {
      state.lastError =
        'Authenticated Admin session or tenant is unavailable.';

      return false;
    }

    const range =
      rangeFromDom(
        root,
      );

    try {
      switch (
        route.finance
      ) {
        case 'overview':
          await applyOverview(
            root,
            range,
            auth,
          );
          break;

        case 'financial-statements':
          await applyProfitLoss(
            root,
            range,
            auth,
          );
          break;

        case 'cash-flow':
          await applyCashFlow(
            root,
            range,
            auth,
          );
          break;

        case 'sales':
          await applySales(
            root,
            range,
            auth,
          );
          break;

        default:
          return false;
      }

      root.setAttribute(
        'data-aquila-finance-r2-7',
        'active',
      );

      state.lastAppliedAt =
        new Date()
          .toISOString();

      return true;
    } catch (
      error
    ) {
      state.lastError =
        String(
          error?.message
          ?? error,
        );

      return false;
    }
  }


  function schedule() {
    const current =
      ++generation;

    [].forEach(
      (
        delay,
      ) => {
        window.setTimeout(
          () => {
            if (
              current
              !== generation
            ) {
              return;
            }

            ensureStyle();

            removeLegacyDeckNodes();

            if (
              isFinance()
            ) {
              void apply();
            }
          },
          delay,
        );
      },
    );
  }


  window
    .__AQUILA_FINANCE_R2_7__ = {
      apply:
        () => apply(),

      diagnostics:
        () => ({
          ...state,

          route:
            routeState(),

          currentRuntimePath,

          financeStyleInstalled:
            Boolean(
              document.getElementById(
                STYLE_ID,
              ),
            ),

          deck:
            q(
              '.ubuzima-glass-workspace-dock,'
              + '[data-ubuzima-workspace-dock]',
            )
              ? {
                  found:
                    true,

                  top:
                    getComputedStyle(
                      q(
                        '.ubuzima-glass-workspace-dock,'
                        + '[data-ubuzima-workspace-dock]',
                      ),
                    ).top,

                  bottom:
                    getComputedStyle(
                      q(
                        '.ubuzima-glass-workspace-dock,'
                        + '[data-ubuzima-workspace-dock]',
                      ),
                    ).bottom,
                }
              : {
                  found:
                    false,
                },
        }),
    };


  ensureStyle();

  removeLegacyDeckNodes();

  void clearRetiredFinanceCacheEntries();


  window.addEventListener(
    'hashchange',
    schedule,
    {
      passive:
        true,
    },
  );

  window.addEventListener(
    'pageshow',
    schedule,
    {
      passive:
        true,
    },
  );

  window.addEventListener(
    'focus',
    schedule,
    {
      passive:
        true,
    },
  );

  document.addEventListener(
    'change',
    (
      event,
    ) => {
      if (
        !isFinance()
        || !(
          event.target
          instanceof Element
        )
      ) {
        return;
      }

      const root =
        workspaceRoot(
          routeState()
            .finance,
        );

      if (
        root
        && root.contains(
          event.target,
        )
      ) {
        requestCache.clear();

        schedule();
      }
    },
    {
      passive:
        true,
    },
  );


  window
    .__AQUILA_FINANCE_R2_7_INSTALLED__ =
    true;


  if (
    document.readyState
    === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      schedule,
      {
        once:
          true,
      },
    );
  } else {
    schedule();
  }
}());

/* AQUILA_FINANCE_SEAMLESS_LOADING_R2_8 */
(function () {
  'use strict';

  if (
    window
      .__AQUILA_FINANCE_SEAMLESS_LOADING_R2_8_INSTALLED__
  ) {
    return;
  }

  const RELEASE =
    'AQUILA_FINANCE_SEAMLESS_LOADING_R2_8';

  const state = {
    release: RELEASE,

    requested: 0,
    completed: 0,
    skippedFresh: 0,
    superseded: 0,
    retries: 0,

    running: false,
    pending: false,

    workspace: null,
    lastReason: null,
    lastSignature: null,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastDurationMs: null,
    lastError: null,

    legacyMultiPassSchedulers:
      'DISABLED',

    focusReload:
      'DISABLED',

    contentBlanking:
      'NO',

    scrollPreservation:
      'ENABLED',
  };

  let generation = 0;

  let draining = false;

  let pendingJob = null;

  let lastCompletedMs = 0;

  const FRESH_MS =
    30000;

  const MOUNT_RETRY_MS = [
    0,
    60,
    150,
    320,
    650,
    1100,
  ];

  const q = (
    selector,
    root = document,
  ) =>
    root?.querySelector?.(
      selector,
    )
    || null;

  const qa = (
    selector,
    root = document,
  ) =>
    root?.querySelectorAll
      ? [
          ...root.querySelectorAll(
            selector,
          ),
        ]
      : [];

  function routeState() {
    const params =
      new URLSearchParams(
        window.location.hash
          .replace(
            /^#/,
            '',
          ),
      );

    return {
      section:
        params.get(
          'section',
        ),

      finance:
        params.get(
          'finance',
        )
        || 'overview',
    };
  }

  function isFinance() {
    return (
      routeState()
        .section
      === 'finance'
    );
  }

  function rootFor(
    workspace,
  ) {
    switch (
      workspace
    ) {
      case 'overview':
        return q(
          '.finance-reference-v1',
        );

      case 'financial-statements':
        return q(
          '.profit-loss-v1',
        );

      case 'cash-flow':
        return q(
          '.cash-flow-v1',
        );

      case 'sales':
        return q(
          '.finance-sales-v1',
        );

      default:
        return q(
          '[data-finance-workspace],'
          + '.finance-workspace,'
          + '.acct-workspace',
        );
    }
  }

  function dateValues(
    root,
  ) {
    if (
      !root
    ) {
      return [];
    }

    return qa(
      'input[type="date"]',
      root,
    )
      .map(
        (
          input,
        ) =>
          String(
            input.value
            || '',
          ),
      );
  }

  function signature() {
    const route =
      routeState();

    const root =
      rootFor(
        route.finance,
      );

    return JSON.stringify(
      {
        section:
          route.section,

        finance:
          route.finance,

        dates:
          dateValues(
            root,
          ),
      },
    );
  }

  function nextFrame() {
    return new Promise(
      (
        resolve,
      ) => {
        window.requestAnimationFrame(
          () => resolve(),
        );
      },
    );
  }

  function wait(
    milliseconds,
  ) {
    return new Promise(
      (
        resolve,
      ) => {
        window.setTimeout(
          resolve,
          milliseconds,
        );
      },
    );
  }

  async function waitForRoot(
    jobGeneration,
  ) {
    for (
      let index = 0;
      index < MOUNT_RETRY_MS.length;
      index += 1
    ) {
      if (
        jobGeneration
        !== generation
      ) {
        state.superseded +=
          1;

        return null;
      }

      if (
        index > 0
      ) {
        state.retries +=
          1;

        await wait(
          MOUNT_RETRY_MS[
            index
          ],
        );
      }

      if (
        !isFinance()
      ) {
        return null;
      }

      const root =
        rootFor(
          routeState()
            .finance,
        );

      if (
        root
      ) {
        return root;
      }
    }

    return null;
  }

  function captureScroll(
    root,
  ) {
    return {
      pageY:
        window.scrollY,

      recentTop:
        q(
          'table[data-aquila-finance-r2-7-recent] tbody',
          root,
        )?.scrollTop
        || 0,

      receivableTop:
        q(
          'table[data-aquila-finance-r2-7-receivables] tbody',
          root,
        )?.scrollTop
        || 0,

      chartLeft:
        qa(
          '.aquila-finance-r2-7-chart-host',
          root,
        ).map(
          (
            host,
          ) =>
            host.scrollLeft,
        ),
    };
  }

  function restoreScroll(
    root,
    snapshot,
  ) {
    const recent =
      q(
        'table[data-aquila-finance-r2-7-recent] tbody',
        root,
      );

    if (
      recent
    ) {
      recent.scrollTop =
        snapshot.recentTop;
    }

    const receivables =
      q(
        'table[data-aquila-finance-r2-7-receivables] tbody',
        root,
      );

    if (
      receivables
    ) {
      receivables.scrollTop =
        snapshot.receivableTop;
    }

    qa(
      '.aquila-finance-r2-7-chart-host',
      root,
    ).forEach(
      (
        host,
        index,
      ) => {
        const wanted =
          snapshot
            .chartLeft[
              index
            ]
          || 0;

        host.scrollLeft =
          Math.min(
            wanted,
            Math.max(
              0,
              host.scrollWidth
              - host.clientWidth,
            ),
          );
      },
    );

    if (
      Math.abs(
        window.scrollY
        - snapshot.pageY
      ) > 2
    ) {
      window.scrollTo(
        {
          top:
            snapshot.pageY,

          left:
            window.scrollX,

          behavior:
            'auto',
        },
      );
    }
  }

  async function applyDataLayer(
    workspace,
  ) {
    if (
      workspace
      === 'overview'
    ) {
      const overview =
        window
          .__AQUILA_FINANCE_OVERVIEW_R2_5__;

      if (
        typeof overview?.apply
        === 'function'
      ) {
        return await overview.apply();
      }

      const fallback =
        window
          .__AQUILA_FINANCE_OVERVIEW_APPLY_R2_4__;

      if (
        typeof fallback
        === 'function'
      ) {
        return await fallback();
      }

      throw new Error(
        'Finance Overview data binder is unavailable.',
      );
    }

    const generic =
      window
        .__AQUILA_FINANCE_EXISTING_UI_APPLY_R2_4__;

    if (
      typeof generic
      !== 'function'
    ) {
      throw new Error(
        'Finance workspace data binder is unavailable.',
      );
    }

    return await generic(
      'r2.8-seamless',
    );
  }

  async function applyPresentationLayer() {
    const visual =
      window
        .__AQUILA_FINANCE_R2_7__;

    if (
      typeof visual?.apply
      !== 'function'
    ) {
      throw new Error(
        'Finance R2.7 presentation layer is unavailable.',
      );
    }

    return await visual.apply();
  }

  async function perform(
    job,
    root,
  ) {
    const started =
      performance.now();

    const route =
      routeState();

    state.running =
      true;

    state.workspace =
      route.finance;

    state.lastReason =
      job.reason;

    state.lastStartedAt =
      new Date()
        .toISOString();

    state.lastError =
      null;

    const scroll =
      captureScroll(
        root,
      );

    /*
     * Accessibility status only.
     * There is intentionally NO visual blanking,
     * opacity reduction, spinner overlay, or skeleton swap.
     */
    root.setAttribute(
      'aria-busy',
      'true',
    );

    root.setAttribute(
      'data-aquila-finance-seamless-loading',
      'updating',
    );

    try {
      /*
       * Keep the currently rendered screen visible while the
       * verified data binder completes.
       */
      await applyDataLayer(
        route.finance,
      );

      /*
       * Immediately apply the accepted R2.7 presentation after
       * the data layer. No 12.8-second re-render cascade.
       */
      await applyPresentationLayer();

      /*
       * One paint boundary only, used to restore user scroll
       * position after atomic table/chart replacement.
       */
      await nextFrame();

      const currentRoot =
        rootFor(
          route.finance,
        )
        || root;

      restoreScroll(
        currentRoot,
        scroll,
      );

      currentRoot.setAttribute(
        'data-aquila-finance-seamless-loading',
        'ready',
      );

      state.completed +=
        1;

      state.lastCompletedAt =
        new Date()
          .toISOString();

      state.lastDurationMs =
        Math.round(
          performance.now()
          - started,
        );

      state.lastSignature =
        signature();

      lastCompletedMs =
        Date.now();

      return true;
    } catch (
      error
    ) {
      state.lastError =
        String(
          error?.message
          ?? error,
        );

      return false;
    } finally {
      root.removeAttribute(
        'aria-busy',
      );

      state.running =
        false;
    }
  }

  async function drain() {
    if (
      draining
    ) {
      return;
    }

    draining =
      true;

    try {
      while (
        pendingJob
      ) {
        const job =
          pendingJob;

        pendingJob =
          null;

        state.pending =
          false;

        if (
          !isFinance()
        ) {
          continue;
        }

        const root =
          await waitForRoot(
            job.generation,
          );

        if (
          !root
        ) {
          if (
            job.generation
            === generation
            && isFinance()
          ) {
            state.lastError =
              'Finance workspace did not mount within the bounded loading window.';
          }

          continue;
        }

        if (
          job.generation
          !== generation
        ) {
          state.superseded +=
            1;

          continue;
        }

        const currentSignature =
          signature();

        if (
          !job.force
          && currentSignature
            === state.lastSignature
          && (
            Date.now()
            - lastCompletedMs
          ) < FRESH_MS
        ) {
          state.skippedFresh +=
            1;

          continue;
        }

        await perform(
          job,
          root,
        );
      }
    } finally {
      draining =
        false;

      if (
        pendingJob
      ) {
        void drain();
      }
    }
  }

  function request(
    reason,
    force = false,
  ) {
    const nextGeneration =
      ++generation;

    state.requested +=
      1;

    /*
     * Only the latest pending navigation/filter request matters.
     * Rapid browser events collapse into one render.
     */
    pendingJob = {
      generation:
        nextGeneration,

      reason,
      force,
    };

    state.pending =
      true;

    void drain();
  }

  window
    .__AQUILA_FINANCE_SEAMLESS_LOADING_R2_8__ = {
      apply:
        () => {
          request(
            'manual',
            true,
          );

          return true;
        },

      diagnostics:
        () => ({
          ...state,

          route:
            routeState(),

          generation,

          freshWindowMs:
            FRESH_MS,

          mountRetryMs:
            [
              ...MOUNT_RETRY_MS,
            ],

          legacyR24:
            Boolean(
              window
                .__AQUILA_FINANCE_RUNTIME_LIFECYCLE_R2_4__,
            ),

          overviewR25:
            Boolean(
              window
                .__AQUILA_FINANCE_OVERVIEW_R2_5__,
            ),

          presentationR27:
            Boolean(
              window
                .__AQUILA_FINANCE_R2_7__,
            ),
        }),
    };

  /*
   * Route navigation is a real reason to load.
   */
  window.addEventListener(
    'hashchange',
    () => {
      request(
        'hashchange',
        true,
      );
    },
    {
      passive:
        true,
    },
  );

  window.addEventListener(
    'popstate',
    () => {
      request(
        'popstate',
        true,
      );
    },
    {
      passive:
        true,
    },
  );

  /*
   * BFCache restoration only.
   * Normal browser focus does NOT trigger a Finance reload.
   */
  window.addEventListener(
    'pageshow',
    (
      event,
    ) => {
      if (
        event.persisted
      ) {
        request(
          'bfcache-restore',
          false,
        );
      }
    },
    {
      passive:
        true,
    },
  );

  /*
   * Genuine Finance filter/date changes.
   */
  document.addEventListener(
    'change',
    (
      event,
    ) => {
      if (
        !isFinance()
        || !(
          event.target
          instanceof Element
        )
      ) {
        return;
      }

      const root =
        rootFor(
          routeState()
            .finance,
        );

      if (
        !root
        || !root.contains(
          event.target,
        )
      ) {
        return;
      }

      if (
        !event.target.matches(
          'input,select',
        )
      ) {
        return;
      }

      request(
        'finance-filter-change',
        true,
      );
    },
    {
      passive:
        true,
    },
  );

  /*
   * Apply / Refresh / Filter buttons may commit a range without
   * dispatching another change event. Queue after the click
   * handler so the current control values have already settled.
   */
  document.addEventListener(
    'click',
    (
      event,
    ) => {
      if (
        !isFinance()
        || !(
          event.target
          instanceof Element
        )
      ) {
        return;
      }

      const button =
        event.target.closest(
          'button,[role="button"]',
        );

      if (
        !button
      ) {
        return;
      }

      const text =
        String(
          button.textContent
          || '',
        )
          .replace(
            /\s+/g,
            ' ',
          )
          .trim()
          .toLowerCase();

      if (
        !(
          text.includes(
            'apply',
          )
          || text.includes(
            'refresh',
          )
          || text.includes(
            'filter',
          )
        )
      ) {
        return;
      }

      window.setTimeout(
        () => {
          request(
            'finance-action',
            true,
          );
        },
        0,
      );
    },
    {
      passive:
        true,
    },
  );

  window
    .__AQUILA_FINANCE_SEAMLESS_LOADING_R2_8_INSTALLED__ =
    true;

  /*
   * Exactly one initial coordinated request.
   */
  if (
    document.readyState
    === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        if (
          isFinance()
        ) {
          request(
            'initial',
            true,
          );
        }
      },
      {
        once:
          true,
      },
    );
  } else if (
    isFinance()
  ) {
    request(
      'initial',
      true,
    );
  }
}());

/* AQUILA_FINANCE_R2_9_1_BROWSER_COMPLETION */
(function () {
  'use strict';

  if (
    window
      .__AQUILA_FINANCE_R2_9_1_INSTALLED__
  ) {
    return;
  }

  const RELEASE =
    'AQUILA_FINANCE_R2_9_1_BROWSER_COMPLETION';

  const STYLE_ID =
    'aquila-finance-r2-9-1-style';

  const requestCache =
    new Map();

  const state = {
    release: RELEASE,

    runs: 0,

    workspace: null,

    chartsRendered: 0,

    monthlyCharts: 0,

    dailyCharts: 0,

    valueLabels: 0,

    dateLabels: 0,

    horizontalScrollCharts: 0,

    recentRows: 0,

    receivableRows: 0,

    deckTopLocked: false,

    lastAppliedAt: null,

    lastDurationMs: null,

    lastError: null,
  };

  const q = (
    selector,
    root = document,
  ) =>
    root?.querySelector?.(
      selector,
    )
    || null;

  const qa = (
    selector,
    root = document,
  ) =>
    root?.querySelectorAll
      ? [
          ...root.querySelectorAll(
            selector,
          ),
        ]
      : [];

  const normalize = (
    value,
  ) =>
    String(
      value ?? '',
    )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim()
      .toLowerCase();

  const numberValue = (
    value,
  ) => {
    if (
      value === null
      || value === undefined
      || value === ''
    ) {
      return null;
    }

    const parsed =
      Number(
        String(
          value,
        ).replace(
          /,/g,
          '',
        ),
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  };

  function deepValue(
    object,
    path,
  ) {
    return String(
      path,
    )
      .split(
        '.',
      )
      .reduce(
        (
          value,
          key,
        ) =>
          value
          && typeof value
            === 'object'
            ? value[key]
            : undefined,
        object,
      );
  }

  function firstValue(
    object,
    paths,
  ) {
    for (
      const path
      of paths
    ) {
      const value =
        deepValue(
          object,
          path,
        );

      if (
        value !== undefined
        && value !== null
        && String(
          value,
        ).trim() !== ''
      ) {
        return value;
      }
    }

    return null;
  }

  function firstNumber(
    object,
    keys,
  ) {
    for (
      const key
      of keys
    ) {
      const value =
        numberValue(
          object?.[key],
        );

      if (
        value !== null
      ) {
        return value;
      }
    }

    return null;
  }


  /* ============================================================
     STYLE
     ============================================================ */

  function ensureStyle() {
    if (
      document.getElementById(
        STYLE_ID,
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style',
      );

    style.id =
      STYLE_ID;

    style.textContent = `

/* ==========================================================
   AQUILA FINANCE R2.9.1
   ========================================================== */

html body .ubuzima-glass-workspace-dock,
html body [data-ubuzima-workspace-dock] {
  position: fixed !important;

  top: 10px !important;
  bottom: auto !important;

  left: 50% !important;
  right: auto !important;

  transform: translateX(-50%) !important;

  width: fit-content !important;
  max-width: calc(100vw - 16px) !important;

  margin: 0 !important;

  z-index: 2147482000 !important;
}

@media (max-width: 767px) {
  html body .ubuzima-glass-workspace-dock,
  html body [data-ubuzima-workspace-dock] {
    top: 6px !important;
    bottom: auto !important;

    max-width: calc(100vw - 8px) !important;
  }
}

.dock-remnant,
.deck-remnant,
.deck-menu-remnant,
.dock-menu-remnant,
.bottom-dock-remnant,
.bottom-dock-ghost,
.bottom-dock-placeholder,
.deck-menu-placeholder,
.deck-placeholder-ghost,
.workspace-bottom-remnant,
.module-bottom-remnant {
  display: none !important;
}


/* ----------------------------------------------------------
   CHARTS
   ---------------------------------------------------------- */

[data-aquila-finance-r291-host] {
  height: auto !important;

  min-height: 248px !important;

  overflow: visible !important;
}

[data-aquila-finance-r291-scroll] {
  display: block !important;

  width: 100% !important;

  overflow-x: auto !important;
  overflow-y: hidden !important;

  overscroll-behavior-x: contain !important;

  scrollbar-gutter: stable !important;

  padding-bottom: 3px !important;
}

[data-aquila-finance-r291-canvas] {
  display: block !important;

  min-height: 248px !important;
}

[data-aquila-finance-r291-chart] {
  display: block !important;

  background: #ffffff !important;

  overflow: visible !important;
}

/* Requested value labels. */
[data-aquila-finance-r291-chart]
  .r291-label-bg {
  fill: #000000 !important;
  stroke: #000000 !important;

  stroke-width: 1 !important;
}

[data-aquila-finance-r291-chart]
  .r291-label-text {
  fill: #ffffff !important;

  font-family: inherit !important;

  font-size: 10px !important;

  font-weight: 800 !important;

  pointer-events: none !important;
}

/* X-axis dates. */
[data-aquila-finance-r291-chart]
  .r291-date-text {
  fill: #334155 !important;

  font-family: inherit !important;

  font-size: 10px !important;

  font-weight: 700 !important;

  pointer-events: none !important;
}

/*
 * R2.9.1 custom SVG intentionally renders NO background
 * grid lines.
 */


/* ----------------------------------------------------------
   RECENT TRANSACTIONS
   ---------------------------------------------------------- */

table[data-aquila-finance-r291-recent] {
  width: 100% !important;

  min-width: 0 !important;

  table-layout: fixed !important;
}

table[data-aquila-finance-r291-recent]
  thead,
table[data-aquila-finance-r291-recent]
  tbody
  tr {
  display: table !important;

  width: 100% !important;

  table-layout: fixed !important;
}

table[data-aquila-finance-r291-recent]
  tbody {
  display: block !important;

  width: 100% !important;

  overflow-y: auto !important;
  overflow-x: hidden !important;

  scrollbar-gutter: stable !important;
}

table[data-aquila-finance-r291-recent]
  th,
table[data-aquila-finance-r291-recent]
  td {
  box-sizing: border-box !important;

  white-space: nowrap !important;

  overflow: hidden !important;

  text-overflow: ellipsis !important;

  vertical-align: middle !important;
}

/* Date */
table[data-aquila-finance-r291-recent]
  th:nth-child(1),
table[data-aquila-finance-r291-recent]
  td:nth-child(1) {
  width: 11% !important;
}

/* Type */
table[data-aquila-finance-r291-recent]
  th:nth-child(2),
table[data-aquila-finance-r291-recent]
  td:nth-child(2) {
  width: 8% !important;
}

/* Description */
table[data-aquila-finance-r291-recent]
  th:nth-child(3),
table[data-aquila-finance-r291-recent]
  td:nth-child(3) {
  width: 33% !important;
}

/* Account */
table[data-aquila-finance-r291-recent]
  th:nth-child(4),
table[data-aquila-finance-r291-recent]
  td:nth-child(4) {
  width: 11% !important;
}

/* Amount */
table[data-aquila-finance-r291-recent]
  th:nth-child(5),
table[data-aquila-finance-r291-recent]
  td:nth-child(5) {
  width: 18% !important;
}

/* Status */
table[data-aquila-finance-r291-recent]
  th:nth-child(6),
table[data-aquila-finance-r291-recent]
  td:nth-child(6) {
  width: 19% !important;
}


/* ----------------------------------------------------------
   TOP RECEIVABLES
   ---------------------------------------------------------- */

table[data-aquila-finance-r291-receivables] {
  width: 100% !important;

  min-width: 0 !important;

  table-layout: fixed !important;
}

table[data-aquila-finance-r291-receivables]
  thead,
table[data-aquila-finance-r291-receivables]
  tbody
  tr {
  display: table !important;

  width: 100% !important;

  table-layout: fixed !important;
}

table[data-aquila-finance-r291-receivables]
  tbody {
  display: block !important;

  width: 100% !important;

  overflow-y: auto !important;
  overflow-x: hidden !important;

  scrollbar-gutter: stable !important;
}

table[data-aquila-finance-r291-receivables]
  th,
table[data-aquila-finance-r291-receivables]
  td {
  box-sizing: border-box !important;

  white-space: nowrap !important;

  overflow: hidden !important;

  text-overflow: ellipsis !important;
}

/* Insurer */
table[data-aquila-finance-r291-receivables]
  th:nth-child(1),
table[data-aquila-finance-r291-receivables]
  td:nth-child(1) {
  width: 26% !important;
}

/* Customer */
table[data-aquila-finance-r291-receivables]
  th:nth-child(2),
table[data-aquila-finance-r291-receivables]
  td:nth-child(2) {
  width: 30% !important;
}

/* Outstanding */
table[data-aquila-finance-r291-receivables]
  th:nth-child(3),
table[data-aquila-finance-r291-receivables]
  td:nth-child(3) {
  width: 25% !important;
}

/* Ageing */
table[data-aquila-finance-r291-receivables]
  th:nth-child(4),
table[data-aquila-finance-r291-receivables]
  td:nth-child(4) {
  width: 19% !important;
}

`;

    document.head.appendChild(
      style,
    );
  }


  function lockDeck() {
    const deck =
      q(
        '.ubuzima-glass-workspace-dock,'
        + '[data-ubuzima-workspace-dock]',
      );

    if (
      !deck
    ) {
      return false;
    }

    deck.setAttribute(
      'data-aquila-deck-top-lock',
      'R2.9.1',
    );

    state.deckTopLocked =
      true;

    return true;
  }


  /* ============================================================
     ROUTE / AUTH / DATES
     ============================================================ */

  function routeState() {
    const params =
      new URLSearchParams(
        window.location.hash
          .replace(
            /^#/,
            '',
          ),
      );

    return {
      section:
        params.get(
          'section',
        ),

      finance:
        params.get(
          'finance',
        )
        || 'overview',
    };
  }


  function workspaceRoot(
    workspace,
  ) {
    if (
      workspace === 'overview'
    ) {
      return (
        q(
          '.finance-reference-v1',
        )
        || q(
          '[data-finance-approved-overview="active"]',
        )
        || q(
          '.finance-overview',
        )
      );
    }

    if (
      workspace
      === 'financial-statements'
    ) {
      return q(
        '.profit-loss-v1',
      );
    }

    if (
      workspace === 'cash-flow'
    ) {
      return q(
        '.cash-flow-v1',
      );
    }

    if (
      workspace === 'sales'
    ) {
      return q(
        '.finance-sales-v1',
      );
    }

    return null;
  }


  function authContext() {
    for (
      const store
      of [
        window.localStorage,
        window.sessionStorage,
      ]
    ) {
      let raw = '';

      try {
        raw =
          store.getItem(
            'ubuzima_admin_session',
          )
          || '';
      } catch {
        raw = '';
      }

      if (
        !raw
      ) {
        continue;
      }

      try {
        const parsed =
          JSON.parse(
            raw,
          );

        const session =
          parsed.session
          || parsed;

        const profile =
          session.profile
          || parsed.profile
          || session.user?.profile
          || parsed.user?.profile
          || session.user
          || parsed.user
          || {};

        const assignment =
          profile
            .tenant_assignments?.[0]
            ?.tenant;

        const tenant =
          (
            typeof assignment
            === 'string'
              ? assignment
              : assignment?.slug
          )
          || profile.tenant?.slug
          || session.tenant?.slug
          || parsed.tenant?.slug
          || profile.scope?.tenant_slug
          || session.tenant_slug
          || parsed.tenant_slug
          || '';

        const token =
          session.token
          || session.access_token
          || parsed.token
          || parsed.access_token
          || '';

        if (
          token
          && tenant
        ) {
          return {
            token,
            tenant,
          };
        }
      } catch {
        /* Continue to another store. */
      }
    }

    return null;
  }


  function isoDate(
    date,
  ) {
    return [
      date.getFullYear(),

      String(
        date.getMonth()
        + 1,
      ).padStart(
        2,
        '0',
      ),

      String(
        date.getDate(),
      ).padStart(
        2,
        '0',
      ),
    ].join(
      '-',
    );
  }


  function currentMonthRange() {
    const today =
      new Date();

    return {
      from:
        isoDate(
          new Date(
            today.getFullYear(),
            today.getMonth(),
            1,
          ),
        ),

      to:
        isoDate(
          today,
        ),
    };
  }


  function detailRange(
    root,
  ) {
    const dates =
      qa(
        'input[type="date"]',
        root,
      )
        .map(
          (
            input,
          ) =>
            String(
              input.value
              || '',
            ),
        )
        .filter(
          (
            value,
          ) =>
            /^\d{4}-\d{2}-\d{2}$/
              .test(
                value,
              ),
        );

    if (
      dates.length >= 2
    ) {
      return {
        from:
          dates[0],

        to:
          dates[1],
      };
    }

    return currentMonthRange();
  }


  function selectedMonths(
    panel,
    fallback = 6,
  ) {
    const select =
      q(
        'select',
        panel,
      );

    if (
      !select
    ) {
      return fallback;
    }

    const text =
      String(
        select.options?.[
          select.selectedIndex
        ]?.textContent
        || select.value
        || '',
      );

    const match =
      text.match(
        /(\d+)\s*month/i,
      );

    if (
      !match
    ) {
      return fallback;
    }

    const count =
      Number(
        match[1],
      );

    return Number.isFinite(
      count,
    )
      && count > 0
      ? count
      : fallback;
  }


  function monthRange(
    months,
  ) {
    const today =
      new Date();

    const count =
      Math.max(
        1,
        Number(
          months,
        )
        || 1,
      );

    const from =
      new Date(
        today.getFullYear(),
        today.getMonth()
        - (
          count
          - 1
        ),
        1,
      );

    return {
      from:
        isoDate(
          from,
        ),

      to:
        isoDate(
          today,
        ),
    };
  }


  /* ============================================================
     API
     ============================================================ */

  async function getJson(
    url,
    auth,
  ) {
    const key =
      auth.tenant
      + '|'
      + url;

    const cached =
      requestCache.get(
        key,
      );

    if (
      cached
      && (
        Date.now()
        - cached.time
      ) < 30000
    ) {
      return cached.value;
    }

    const value =
      fetch(
        url,
        {
          method:
            'GET',

          credentials:
            'same-origin',

          cache:
            'no-store',

          headers: {
            Accept:
              'application/json',

            Authorization:
              'Bearer '
              + auth.token,

            'X-Tenant-Slug':
              auth.tenant,
          },
        },
      )
        .then(
          async (
            response,
          ) => ({
            ok:
              response.ok,

            status:
              response.status,

            payload:
              await response
                .json()
                .catch(
                  () => ({}),
                ),
          }),
        )
        .catch(
          (
            error,
          ) => ({
            ok:
              false,

            status:
              0,

            payload:
              {},

            error:
              String(
                error?.message
                ?? error,
              ),
          }),
        );

    requestCache.set(
      key,
      {
        time:
          Date.now(),

        value,
      },
    );

    return value;
  }


  function commercialUrl(
    endpoint,
    range,
    perPage = 400,
  ) {
    const url =
      new URL(
        '/api/v1/pharmaco/finance/commercial/'
        + endpoint,
        window.location.origin,
      );

    url.searchParams.set(
      'from',
      range.from,
    );

    url.searchParams.set(
      'to',
      range.to,
    );

    url.searchParams.set(
      'page',
      '1',
    );

    url.searchParams.set(
      'per_page',
      String(
        perPage,
      ),
    );

    return (
      url.pathname
      + url.search
    );
  }


  function unwrap(
    payload,
  ) {
    let value =
      payload;

    for (
      let index = 0;
      index < 4;
      index += 1
    ) {
      if (
        value
        && !Array.isArray(
          value,
        )
        && typeof value
          === 'object'
        && value.data
          !== undefined
        && !value.rows
        && !value.series
        && !value.summary
      ) {
        value =
          value.data;

        continue;
      }

      break;
    }

    return value;
  }


  function rowsFrom(
    payload,
  ) {
    const value =
      unwrap(
        payload,
      );

    if (
      Array.isArray(
        value,
      )
    ) {
      return value;
    }

    if (
      !value
      || typeof value
        !== 'object'
    ) {
      return [];
    }

    for (
      const candidate
      of [
        value.rows,
        value.records,
        value.items,
        value.sales,
        value.returns,
        value.receivables,
        value.transactions,
        value.data,
        value.data?.data,
        payload?.returns,
        payload?.data?.rows,
        payload?.data?.data,
      ]
    ) {
      if (
        Array.isArray(
          candidate,
        )
      ) {
        return candidate;
      }
    }

    return [];
  }


  function rowDate(
    row,
  ) {
    return String(
      firstValue(
        row,
        [
          'business_date',
          'label',
          'date',
          'posting_date',
          'sold_at',
          'received_at',
          'created_at',
        ],
      )
      || '',
    ).slice(
      0,
      10,
    );
  }


  function seriesFrom(
    payload,
  ) {
    const value =
      unwrap(
        payload,
      );

    if (
      !value
      || typeof value
        !== 'object'
    ) {
      return [];
    }

    for (
      const candidate
      of [
        value.series,
        value.trend,
        value.timeline,
        value.data?.series,
        payload?.data?.series,
      ]
    ) {
      if (
        Array.isArray(
          candidate,
        )
      ) {
        return [
          ...candidate,
        ].sort(
          (
            left,
            right,
          ) =>
            rowDate(
              left,
            ).localeCompare(
              rowDate(
                right,
              ),
            ),
        );
      }
    }

    return [];
  }


  /* ============================================================
     CHART VALUES
     ============================================================ */

  function incomeValue(
    row,
  ) {
    return firstNumber(
      row,
      [
        'primary',
        'income',
        'revenue',
        'sales',
        'value',
      ],
    );
  }


  function expenseValue(
    row,
  ) {
    return firstNumber(
      row,
      [
        'secondary',
        'expenses',
        'expense',
        'returns',
      ],
    );
  }


  function cashInValue(
    row,
  ) {
    return firstNumber(
      row,
      [
        'cash_in',
        'cash_inflow',
        'inflow',
        'receipts',
        'primary',
      ],
    );
  }


  function cashOutValue(
    row,
  ) {
    return firstNumber(
      row,
      [
        'cash_out',
        'cash_outflow',
        'outflow',
        'payments',
        'secondary',
      ],
    );
  }


  function pnlNetValue(
    row,
  ) {
    const explicit =
      firstNumber(
        row,
        [
          'net_profit',
          'net_income',
          'net',
          'tertiary',
        ],
      );

    if (
      explicit !== null
    ) {
      return explicit;
    }

    const income =
      incomeValue(
        row,
      );

    const expense =
      expenseValue(
        row,
      );

    if (
      income === null
    ) {
      return null;
    }

    return (
      income
      - (
        expense
        ?? 0
      )
    );
  }


  function cashNetValue(
    row,
  ) {
    const explicit =
      firstNumber(
        row,
        [
          'net_cash_flow',
          'net_cash',
          'net_flow',
          'net',
          'tertiary',
        ],
      );

    if (
      explicit !== null
    ) {
      return explicit;
    }

    const input =
      cashInValue(
        row,
      );

    const output =
      cashOutValue(
        row,
      );

    if (
      input === null
    ) {
      return null;
    }

    return (
      input
      - (
        output
        ?? 0
      )
    );
  }


  function monthlyBuckets(
    input,
    definitions,
    range,
  ) {
    const buckets =
      new Map();

    const start =
      new Date(
        range.from
        + 'T00:00:00',
      );

    const end =
      new Date(
        range.to
        + 'T00:00:00',
      );

    let current =
      new Date(
        start.getFullYear(),
        start.getMonth(),
        1,
      );

    const last =
      new Date(
        end.getFullYear(),
        end.getMonth(),
        1,
      );

    while (
      current <= last
    ) {
      const key =
        current.getFullYear()
        + '-'
        + String(
          current.getMonth()
          + 1,
        ).padStart(
          2,
          '0',
        );

      buckets.set(
        key,
        {
          business_date:
            key
            + '-01',

          values:
            definitions.map(
              () => 0,
            ),

          present:
            definitions.map(
              () => false,
            ),
        },
      );

      current =
        new Date(
          current.getFullYear(),
          current.getMonth()
          + 1,
          1,
        );
    }

    input.forEach(
      (
        row,
      ) => {
        const date =
          rowDate(
            row,
          );

        if (
          !/^\d{4}-\d{2}-\d{2}$/
            .test(
              date,
            )
        ) {
          return;
        }

        const key =
          date.slice(
            0,
            7,
          );

        if (
          !buckets.has(
            key,
          )
        ) {
          return;
        }

        const bucket =
          buckets.get(
            key,
          );

        definitions.forEach(
          (
            definition,
            index,
          ) => {
            const value =
              numberValue(
                definition.value(
                  row,
                ),
              );

            if (
              value === null
            ) {
              return;
            }

            bucket.values[
              index
            ] += value;

            bucket.present[
              index
            ] = true;
          },
        );
      },
    );

    /*
     * Months without underlying postings remain NULL.
     * The month is still visible on the x-axis, but no financial
     * value is fabricated.
     */
    return [
      ...buckets.values(),
    ].map(
      (
        bucket,
      ) => ({
        business_date:
          bucket.business_date,

        __aquila_values:
          bucket.values.map(
            (
              value,
              index,
            ) =>
              bucket.present[
                index
              ]
                ? value
                : null,
          ),
      }),
    );
  }


  function compactNumber(
    raw,
  ) {
    const value =
      numberValue(
        raw,
      );

    if (
      value === null
    ) {
      return '';
    }

    const absolute =
      Math.abs(
        value,
      );

    if (
      absolute >= 1000000000
    ) {
      return (
        value
        / 1000000000
      ).toFixed(
        1,
      )
        .replace(
          /\.0$/,
          '',
        )
        + 'B';
    }

    if (
      absolute >= 1000000
    ) {
      return (
        value
        / 1000000
      ).toFixed(
        1,
      )
        .replace(
          /\.0$/,
          '',
        )
        + 'M';
    }

    if (
      absolute >= 1000
    ) {
      return (
        value
        / 1000
      ).toFixed(
        1,
      )
        .replace(
          /\.0$/,
          '',
        )
        + 'K';
    }

    return Math.round(
      value,
    ).toLocaleString(
      'en-US',
    );
  }


  function dateLabel(
    raw,
    monthly,
  ) {
    const value =
      String(
        raw
        || '',
      ).slice(
        0,
        10,
      );

    const match =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

    if (
      !match
    ) {
      return value;
    }

    const date =
      new Date(
        Number(
          match[1],
        ),
        Number(
          match[2],
        ) - 1,
        Number(
          match[3],
        ),
      );

    return new Intl
      .DateTimeFormat(
        'en-GB',
        monthly
          ? {
              month:
                'short',

              year:
                'numeric',
            }
          : {
              day:
                '2-digit',

              month:
                'short',
            },
      )
      .format(
        date,
      );
  }


  /* ============================================================
     ACTUAL CHART DOM DISCOVERY
     ============================================================ */

  function panelByTitle(
    root,
    titles,
  ) {
    const wanted =
      titles.map(
        normalize,
      );

    const elements =
      qa(
        'h1,h2,h3,h4,h5,h6,'
        + 'strong,b,span,p,div',
        root,
      );

    for (
      const element
      of elements
    ) {
      if (
        !wanted.includes(
          normalize(
            element.textContent,
          ),
        )
      ) {
        continue;
      }

      let node =
        element;

      for (
        let depth = 0;
        depth < 8;
        depth += 1
      ) {
        node =
          node.parentElement;

        if (
          !node
          || node === root
        ) {
          break;
        }

        const svgs =
          qa(
            'svg',
            node,
          ).filter(
            (
              svg,
            ) =>
              !svg.closest(
                'button',
              ),
          );

        if (
          svgs.length
          && node
            .getBoundingClientRect()
            .width > 300
        ) {
          return node;
        }
      }
    }

    return null;
  }


  function svgElement(
    name,
    attributes = {},
  ) {
    const element =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        name,
      );

    Object.entries(
      attributes,
    ).forEach(
      (
        [
          key,
          value,
        ],
      ) => {
        element.setAttribute(
          key,
          String(
            value,
          ),
        );
      },
    );

    return element;
  }


  function largestNativeSvg(
    panel,
  ) {
    return (
      qa(
        'svg',
        panel,
      )
        .filter(
          (
            svg,
          ) =>
            !svg.closest(
              'button',
            )
            && !svg.matches(
              '[data-aquila-finance-r291-chart]',
            ),
        )
        .sort(
          (
            left,
            right,
          ) => {
            const leftBox =
              left
                .getBoundingClientRect();

            const rightBox =
              right
                .getBoundingClientRect();

            return (
              rightBox.width
              * rightBox.height
              - leftBox.width
              * leftBox.height
            );
          },
        )[0]
      || null
    );
  }


  function renderChart(
    panel,
    rawSeries,
    definitions,
    granularity,
    range,
  ) {
    if (
      !panel
      || !rawSeries.length
      || !definitions.length
    ) {
      return false;
    }

    let series =
      rawSeries;

    let preparedDefinitions =
      definitions;

    if (
      granularity === 'monthly'
    ) {
      series =
        monthlyBuckets(
          rawSeries,
          definitions,
          range,
        );

      preparedDefinitions =
        definitions.map(
          (
            definition,
            index,
          ) => ({
            ...definition,

            value:
              (
                row,
              ) =>
                row
                  .__aquila_values?.[
                    index
                  ]
                ?? null,
          }),
        );
    }

    if (
      !series.length
    ) {
      return false;
    }

    const native =
      largestNativeSvg(
        panel,
      );

    if (
      !native
      || !native.parentElement
    ) {
      return false;
    }

    const host =
      native.parentElement;

    host.setAttribute(
      'data-aquila-finance-r291-host',
      'true',
    );

    /*
     * Neutralize the old R2.7 visual owner classes.
     */
    host.classList.remove(
      'aquila-finance-r2-7-chart-host',
    );

    panel.classList.remove(
      'aquila-finance-r2-7-chart-target',
    );

    const oldScrolls =
  Array.from(
    host.querySelectorAll(
      '[data-aquila-finance-r291-scroll]'
    )
  );

const previousScrollLeft =
  oldScrolls.length
    ? (
        oldScrolls[
          oldScrolls.length - 1
        ].scrollLeft
        || 0
      )
    : 0;

oldScrolls.forEach(
  element => element.remove()
);

    const prepared =
      preparedDefinitions
        .map(
          (
            definition,
          ) => ({
            ...definition,

            values:
              series.map(
                (
                  row,
                  index,
                ) =>
                  numberValue(
                    definition.value(
                      row,
                      index,
                    ),
                  ),
              ),
          }),
        )
        .filter(
          (
            definition,
          ) =>
            definition.values
              .some(
                (
                  value,
                ) =>
                  value !== null,
              ),
        );

    if (
      !prepared.length
    ) {
      return false;
    }

    const visibleWidth =
      Math.max(
        560,
        Math.round(
          host
            .getBoundingClientRect()
            .width
          || 0,
        ),
      );

    const pointWidth =
      granularity === 'monthly'
        ? 170
        : 92;

    const width =
      Math.max(
        visibleWidth,

        82
        + series.length
        * pointWidth,
      );

    const height =
      248;

    const left = 42;
    const right = 34;
    const top = 34;
    const bottom = 44;

    const plotWidth =
      width
      - left
      - right;

    const plotHeight =
      height
      - top
      - bottom;

    const allValues =
      prepared
        .flatMap(
          (
            definition,
          ) =>
            definition.values,
        )
        .filter(
          (
            value,
          ) =>
            value !== null,
        );

    let minimum =
      Math.min(
        0,
        ...allValues,
      );

    let maximum =
      Math.max(
        0,
        ...allValues,
      );

    if (
      minimum === maximum
    ) {
      maximum =
        minimum + 1;
    }

    const padding =
      Math.max(
        1,

        (
          maximum
          - minimum
        )
        * 0.08,
      );

    maximum +=
      padding;

    if (
      minimum < 0
    ) {
      minimum -=
        padding;
    }

    const x =
      (
        index,
      ) =>
        series.length === 1
          ? left
            + plotWidth / 2
          : left
            + index
            * plotWidth
            / (
              series.length
              - 1
            );

    const y =
      (
        value,
      ) =>
        top
        + (
          maximum
          - value
        )
        / (
          maximum
          - minimum
        )
        * plotHeight;

    const scroll =
      document.createElement(
        'div',
      );

    scroll.setAttribute(
      'data-aquila-finance-r291-scroll',
      'true',
    );

    const canvas =
      document.createElement(
        'div',
      );

    canvas.setAttribute(
      'data-aquila-finance-r291-canvas',
      'true',
    );

    canvas.style.width =
      width
      + 'px';

    canvas.style.minWidth =
      width
      + 'px';

    canvas.style.height =
      height
      + 'px';

    const svg =
      svgElement(
        'svg',
        {
          width,
          height,

          viewBox:
            `0 0 ${width} ${height}`,

          'data-aquila-finance-r291-chart':
            'true',

          role:
            'img',
        },
      );

    const colours = [
      '#16a34a',
      '#dc2626',
      '#2563eb',
      '#7c3aed',
    ];

    prepared.forEach(
      (
        definition,
        seriesIndex,
      ) => {
        const colour =
          definition.colour
          || colours[
            seriesIndex
            % colours.length
          ];

        let segment =
          [];

        const flush =
          () => {
            if (
              segment.length > 1
            ) {
              svg.appendChild(
                svgElement(
                  'polyline',
                  {
                    points:
                      segment.join(
                        ' ',
                      ),

                    fill:
                      'none',

                    stroke:
                      colour,

                    'stroke-width':
                      2.7,

                    'stroke-linecap':
                      'round',

                    'stroke-linejoin':
                      'round',
                  },
                ),
              );
            }

            segment =
              [];
          };

        definition.values.forEach(
          (
            value,
            index,
          ) => {
            if (
              value === null
            ) {
              flush();
              return;
            }

            segment.push(
              `${x(index)},${y(value)}`,
            );
          },
        );

        flush();

        definition.values.forEach(
          (
            value,
            index,
          ) => {
            if (
              value === null
            ) {
              return;
            }

            svg.appendChild(
              svgElement(
                'circle',
                {
                  cx:
                    x(index),

                  cy:
                    y(value),

                  r:
                    3.3,

                  fill:
                    colour,
                },
              ),
            );

            if (
              definition.hideZero
              && Math.abs(
                value,
              ) < 0.000000001
            ) {
              return;
            }

            const label =
              compactNumber(
                value,
              );

            if (
              !label
            ) {
              return;
            }

            const boxWidth =
              Math.max(
                34,

                label.length
                * 6.7
                + 12,
              );

            const boxHeight =
              19;

            const offset =
              prepared.length === 1
                ? -16
                : seriesIndex === 0
                  ? -17
                  : 17
                    + (
                      seriesIndex
                      - 1
                    )
                    * 17;

            const centerX =
              Math.max(
                boxWidth / 2
                + 2,

                Math.min(
                  width
                  - boxWidth / 2
                  - 2,

                  x(index),
                ),
              );

            let centerY =
              y(value)
              + offset;

            centerY =
              Math.max(
                14,

                Math.min(
                  height
                  - bottom
                  - 7,

                  centerY,
                ),
              );

            const group =
              svgElement(
                'g',
              );

            group.appendChild(
              svgElement(
                'rect',
                {
                  x:
                    centerX
                    - boxWidth / 2,

                  y:
                    centerY
                    - 12,

                  width:
                    boxWidth,

                  height:
                    boxHeight,

                  rx:
                    4,

                  ry:
                    4,

                  class:
                    'r291-label-bg',
                },
              ),
            );

            const text =
              svgElement(
                'text',
                {
                  x:
                    centerX,

                  y:
                    centerY
                    + 1,

                  'text-anchor':
                    'middle',

                  class:
                    'r291-label-text',
                },
              );

            text.textContent =
              label;

            group.appendChild(
              text,
            );

            svg.appendChild(
              group,
            );

            state.valueLabels +=
              1;
          },
        );
      },
    );

    /*
     * X-axis labels.
     */
    series.forEach(
      (
        row,
        index,
      ) => {
        const date =
          rowDate(
            row,
          );

        if (
          !date
        ) {
          return;
        }

        const text =
          svgElement(
            'text',
            {
              x:
                x(index),

              y:
                height
                - 10,

              'text-anchor':
                'middle',

              class:
                'r291-date-text',
            },
          );

        text.textContent =
          dateLabel(
            date,
            granularity
            === 'monthly',
          );

        svg.appendChild(
          text,
        );

        state.dateLabels +=
          1;
      },
    );

    canvas.appendChild(
      svg,
    );

    scroll.appendChild(
      canvas,
    );

    /*
     * Build new chart before hiding old chart.
     * This preserves the seamless loading experience.
     */
    host.appendChild(
      scroll,
    );

    native.setAttribute(
      'data-aquila-finance-r291-native',
      'true',
    );

    native.style.display =
      'none';

    qa(
      '[data-aquila-finance-r2-7-canvas],'
      + '[data-aquila-finance-r2-6-overlay],'
      + '[data-aquila-finance-r2-5-series]',
      host,
    ).forEach(
      (
        element,
      ) => {
        element.remove();
      },
    );

    

    window.requestAnimationFrame(
      () => {
        scroll.scrollLeft =
          Math.min(
            previousScrollLeft,

            Math.max(
              0,

              scroll.scrollWidth
              - scroll.clientWidth,
            ),
          );
      },
    );

    if (
      width
      > visibleWidth
      + 2
    ) {
      state.horizontalScrollCharts +=
        1;
    }

    state.chartsRendered +=
      1;

    if (
      granularity === 'monthly'
    ) {
      state.monthlyCharts +=
        1;
    } else {
      state.dailyCharts +=
        1;
    }

    return true;
  }


  /* ============================================================
     TABLES
     ============================================================ */

  function money(
    raw,
  ) {
    const value =
      numberValue(
        raw,
      );

    if (
      value === null
    ) {
      return '—';
    }

    return (
      'RWF '
      + new Intl
        .NumberFormat(
          'en-US',
          {
            maximumFractionDigits:
              0,
          },
        )
        .format(
          value,
        )
    );
  }


  function niceText(
    raw,
  ) {
    const value =
      String(
        raw
        ?? '',
      )
        .replace(
          /[_-]+/g,
          ' ',
        )
        .trim();

    if (
      !value
    ) {
      return '—';
    }

    return value.replace(
      /\b\w/g,
      (
        character,
      ) =>
        character
          .toUpperCase(),
    );
  }


  function dateOnly(
    raw,
  ) {
    const value =
      String(
        raw
        || '',
      ).slice(
        0,
        10,
      );

    return (
      value
      || '—'
    );
  }


  function fitFiveRows(
    body,
  ) {
    const rows =
      qa(
        ':scope > tr',
        body,
      ).slice(
        0,
        5,
      );

    if (
      !rows.length
    ) {
      return;
    }

    const height =
      rows.reduce(
        (
          total,
          row,
        ) =>
          total
          + row
            .getBoundingClientRect()
            .height,
        0,
      );

    if (
      height > 0
    ) {
      body.style.maxHeight =
        Math.ceil(
          height,
        )
        + 'px';
    }
  }


  function recentValue(
    header,
    row,
  ) {
    if (
      header.includes(
        'date',
      )
    ) {
      return dateOnly(
        firstValue(
          row,
          [
            'business_date',
            'received_at',
            'paid_at',
            'posting_date',
            'created_at',
          ],
        ),
      );
    }

    if (
      header.includes(
        'type',
      )
    ) {
      return niceText(
        firstValue(
          row,
          [
            'transaction_type',
            'source_type',
            'type',
            'event_type',
            'payment_method',
          ],
        ),
      );
    }

    if (
      header.includes(
        'description',
      )
    ) {
      return (
        firstValue(
          row,
          [
            'description',
            'memo',
            'narration',
            'reference_number',
            'reference',
            'sale_number',
            'receipt_number',
          ],
        )
        || '—'
      );
    }

    if (
      header.includes(
        'account',
      )
    ) {
      return (
        firstValue(
          row,
          [
            'account_name',
            'account',
            'account_code',
            'payment_method',
            'channel',
            'method',
          ],
        )
        || '—'
      );
    }

    if (
      header.includes(
        'amount',
      )
    ) {
      return money(
        firstNumber(
          row,
          [
            'amount',
            'payment_amount',
            'paid_amount',
            'cash_in',
            'inflow',
            'credit',
            'debit',
          ],
        ),
      );
    }

    if (
      header.includes(
        'status',
      )
    ) {
      return niceText(
        firstValue(
          row,
          [
            'status',
            'payment_status',
            'reconciliation_status',
          ],
        ),
      );
    }

    return '—';
  }


  function renderRecent(
    root,
    rows,
  ) {
    const panel =
      q(
        '.finance-reference-v1__panel--transactions',
        root,
      );

    const table =
      panel
      && q(
        'table',
        panel,
      );

    const body =
      table
      && q(
        'tbody',
        table,
      );

    const heads =
      table
        ? qa(
            'thead th',
            table,
          )
        : [];

    if (
      !table
      || !body
      || !heads.length
    ) {
      return false;
    }

    const previousTop =
      body.scrollTop;

    table.setAttribute(
      'data-aquila-finance-r291-recent',
      'true',
    );

    const labels =
      heads.map(
        (
          head,
        ) =>
          normalize(
            head.textContent,
          ),
      );

    const fragment =
      document.createDocumentFragment();

    rows.forEach(
      (
        row,
      ) => {
        const tr =
          document.createElement(
            'tr',
          );

        labels.forEach(
          (
            header,
          ) => {
            const value =
              recentValue(
                header,
                row,
              );

            const td =
              document.createElement(
                'td',
              );

            td.textContent =
              value;

            td.title =
              value;

            tr.appendChild(
              td,
            );
          },
        );

        fragment.appendChild(
          tr,
        );
      },
    );

    if (
      !rows.length
    ) {
      const tr =
        document.createElement(
          'tr',
        );

      const td =
        document.createElement(
          'td',
        );

      td.colSpan =
        heads.length;

      td.textContent =
        'No data available';

      tr.appendChild(
        td,
      );

      fragment.appendChild(
        tr,
      );
    }

    body.replaceChildren(
      fragment,
    );

    fitFiveRows(
      body,
    );

    body.scrollTop =
      previousTop;

    state.recentRows =
      rows.length;

    return true;
  }


  function parseMetadata(
    row,
  ) {
    if (
      row?.metadata
      && typeof row.metadata
        === 'object'
    ) {
      return row.metadata;
    }

    if (
      typeof row?.metadata
      === 'string'
    ) {
      try {
        return JSON.parse(
          row.metadata,
        );
      } catch {
        return {};
      }
    }

    return {};
  }


  function insurerName(
    row,
  ) {
    const metadata =
      parseMetadata(
        row,
      );

    return (
      firstValue(
        row,
        [
          'insurer_name',
          'insurance_name',
          'insurance_partner_name',
          'insurance_provider_name',

          'insurer.name',
          'insurance.name',
          'insurance.partner_name',

          'payer.insurer_name',
          'payer.insurance_name',
        ],
      )

      || firstValue(
        metadata,
        [
          'insurance.partner_name',
          'insurance.insurer_name',
          'insurance.name',

          'insurance_partner_name',
          'insurer_name',
        ],
      )

      || '—'
    );
  }


  function customerName(
    row,
  ) {
    return (
      firstValue(
        row,
        [
          'customer_name',
          'transaction_customer_name',

          'customer.name',
          'customer.full_name',

          'patient_name',
          'member_name',
          'payer_name',
        ],
      )
      || '—'
    );
  }


  function outstandingValue(
    row,
  ) {
    return firstNumber(
      row,
      [
        'balance_amount',
        'outstanding',
        'outstanding_amount',
        'receivable_amount',
        'amount_due',
      ],
    );
  }


  function ageingDays(
    row,
    asOf,
  ) {
    const explicit =
      firstNumber(
        row,
        [
          'ageing_days',
          'aging_days',
        ],
      );

    if (
      explicit !== null
    ) {
      return Math.max(
        0,
        Math.round(
          explicit,
        ),
      );
    }

    const start =
      String(
        firstValue(
          row,
          [
            'business_date',
            'sold_at',
            'issued_at',
            'created_at',
            'due_date',
          ],
        )
        || '',
      ).slice(
        0,
        10,
      );

    if (
      !/^\d{4}-\d{2}-\d{2}$/
        .test(
          start,
        )
      || !/^\d{4}-\d{2}-\d{2}$/
        .test(
          asOf,
        )
    ) {
      return '—';
    }

    const milliseconds =
      new Date(
        asOf
        + 'T00:00:00',
      ).getTime()
      - new Date(
          start
          + 'T00:00:00',
        ).getTime();

    if (
      !Number.isFinite(
        milliseconds,
      )
    ) {
      return '—';
    }

    return Math.max(
      0,
      Math.floor(
        milliseconds
        / 86400000,
      ),
    );
  }


  function renderReceivables(
    root,
    rows,
    range,
  ) {
    const panel =
      q(
        '.finance-reference-v1__panel--receivables',
        root,
      );

    const table =
      panel
      && q(
        'table',
        panel,
      );

    const head =
      table
      && q(
        'thead',
        table,
      );

    const body =
      table
      && q(
        'tbody',
        table,
      );

    if (
      !table
      || !head
      || !body
    ) {
      return false;
    }

    const previousTop =
      body.scrollTop;

    table.setAttribute(
      'data-aquila-finance-r291-receivables',
      'true',
    );

    const headRow =
      document.createElement(
        'tr',
      );

    [
      'Insurer',
      'Customer',
      'Outstanding',
      'Ageing (Days)',
    ].forEach(
      (
        label,
      ) => {
        const th =
          document.createElement(
            'th',
          );

        th.textContent =
          label;

        headRow.appendChild(
          th,
        );
      },
    );

    head.replaceChildren(
      headRow,
    );

    const sorted =
      [
        ...rows,
      ].sort(
        (
          left,
          right,
        ) =>
          (
            outstandingValue(
              right,
            )
            || 0
          )
          - (
            outstandingValue(
              left,
            )
            || 0
          ),
      );

    const fragment =
      document.createDocumentFragment();

    sorted.forEach(
      (
        row,
      ) => {
        const values = [
          insurerName(
            row,
          ),

          customerName(
            row,
          ),

          money(
            outstandingValue(
              row,
            ),
          ),

          String(
            ageingDays(
              row,
              range.to,
            ),
          ),
        ];

        const tr =
          document.createElement(
            'tr',
          );

        values.forEach(
          (
            value,
          ) => {
            const td =
              document.createElement(
                'td',
              );

            td.textContent =
              value;

            td.title =
              value;

            tr.appendChild(
              td,
            );
          },
        );

        fragment.appendChild(
          tr,
        );
      },
    );

    if (
      !sorted.length
    ) {
      const tr =
        document.createElement(
          'tr',
        );

      const td =
        document.createElement(
          'td',
        );

      td.colSpan =
        4;

      td.textContent =
        'No data available';

      tr.appendChild(
        td,
      );

      fragment.appendChild(
        tr,
      );
    }

    body.replaceChildren(
      fragment,
    );

    fitFiveRows(
      body,
    );

    body.scrollTop =
      previousTop;

    state.receivableRows =
      sorted.length;

    return true;
  }


  /* ============================================================
     SALES RETURNS
     ============================================================ */

  async function refundMap(
    range,
    auth,
  ) {
    const response =
      await getJson(
        '/api/v1/pharmaco/sales/returns',
        auth,
      );

    if (
      !response.ok
    ) {
      return null;
    }

    const result =
      new Map();

    rowsFrom(
      response.payload,
    ).forEach(
      (
        row,
      ) => {
        if (
          normalize(
            row?.status,
          )
          !== 'refunded'
        ) {
          return;
        }

        const date =
          String(
            firstValue(
              row,
              [
                'refunded_at',
                'approved_at',
                'requested_at',
                'created_at',
              ],
            )
            || '',
          ).slice(
            0,
            10,
          );

        if (
          !date
          || date < range.from
          || date > range.to
        ) {
          return;
        }

        const amount =
          firstNumber(
            row,
            [
              'approved_refund_amount',
              'requested_refund_amount',
              'refund_amount',
            ],
          );

        if (
          amount === null
        ) {
          return;
        }

        result.set(
          date,
          (
            result.get(
              date,
            )
            || 0
          )
          + amount,
        );
      },
    );

    return result;
  }


  /* ============================================================
     WORKSPACES
     ============================================================ */


  /*
   * ============================================================
   * AQUILA_FINANCE_OVERVIEW_MANAGEMENT_R1_BEGIN
   *
   * Presentation-only Finance Overview enhancement.
   *
   * Existing applyOverview() remains the authoritative data owner.
   * No API, route owner, listener, timer, observer, history writer
   * or financial calculation is introduced here.
   * ============================================================
   */

  function aqOverviewMgmtR1Present(
    root
  ) {

    try {

      const current =
        routeState();

      if (
        !current
        ||
        current.finance
        !==
        'overview'
      ) {
        return false;
      }

      if (
        current.section
        &&
        current.section
        !==
        'finance'
      ) {
        return false;
      }


      const overview =
        (
          root
          &&
          typeof root.matches
          ===
          'function'
          &&
          root.matches(
            '.finance-reference-v1'
          )
        )
        ?
        root
        :
        (
          root
          &&
          typeof root.querySelector
          ===
          'function'
        )
        ?
        root.querySelector(
          '.finance-reference-v1'
        )
        :
        null;


      if (
        !overview
      ) {
        return false;
      }


      overview.setAttribute(
        'data-aquila-overview-mgmt-r1',
        'active'
      );


      /*
       * ----------------------------------------------------------
       * ONE SCOPED PRESENTATION STYLE
       * ----------------------------------------------------------
       */

      const styleId =
        'aquila-finance-overview-mgmt-r1-style';


      if (
        !document.getElementById(
          styleId
        )
      ) {

        const style =
          document.createElement(
            'style'
          );

        style.id =
          styleId;

        style.textContent = `
[data-aquila-overview-mgmt-r1="active"] {
  --aq-overview-ink: #0f172a;
  --aq-overview-muted: #64748b;
  --aq-overview-line: #e2e8f0;
  --aq-overview-soft: #f8fafc;
  --aq-overview-green: #16a34a;
  --aq-overview-blue: #2563eb;
  --aq-overview-amber: #d97706;
  --aq-overview-violet: #7c3aed;
}

[data-aquila-overview-mgmt-r1="active"]
.aq-overview-mgmt-r1-banner {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin: 0 0 18px;
  padding: 20px 22px;
  border: 1px solid var(--aq-overview-line);
  border-left: 4px solid #0f766e;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, .05);
}

[data-aquila-overview-mgmt-r1="active"]
.aq-overview-mgmt-r1-copy {
  min-width: 0;
  max-width: 760px;
}

[data-aquila-overview-mgmt-r1="active"]
.aq-overview-mgmt-r1-eyebrow {
  margin: 0 0 6px;
  color: #0f766e;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  line-height: 1.2;
  text-transform: uppercase;
}

[data-aquila-overview-mgmt-r1="active"]
.aq-overview-mgmt-r1-title {
  margin: 0;
  color: var(--aq-overview-ink);
  font-size: clamp(22px, 2.2vw, 30px);
  font-weight: 800;
  line-height: 1.15;
}

[data-aquila-overview-mgmt-r1="active"]
.aq-overview-mgmt-r1-subtitle {
  margin: 8px 0 0;
  max-width: 700px;
  color: var(--aq-overview-muted);
  font-size: 13px;
  line-height: 1.55;
}

[data-aquila-overview-mgmt-r1="active"]
.aq-overview-mgmt-r1-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

[data-aquila-overview-mgmt-r1="active"]
.aq-overview-mgmt-r1-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid var(--aq-overview-line);
  border-radius: 999px;
  background: var(--aq-overview-soft);
  color: #334155;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

[data-aquila-overview-mgmt-r1="active"]
.finance-reference-v1__metrics {
  gap: 14px !important;
}

[data-aquila-overview-mgmt-r1="active"]
.finance-reference-v1__metric,
[data-aquila-overview-mgmt-r1="active"]
.finance-reference-v1__metric-card {
  min-width: 0;
  min-height: 124px;
  border-color: var(--aq-overview-line) !important;
  background: #ffffff !important;
  box-shadow: 0 6px 18px rgba(15, 23, 42, .04);
}

[data-aquila-overview-mgmt-r1="active"]
.finance-reference-v1__panel,
[data-aquila-overview-mgmt-r1="active"]
.finance-reference-v1__bank-accounts {
  min-width: 0;
  border-color: var(--aq-overview-line) !important;
  background: #ffffff !important;
  box-shadow: 0 6px 18px rgba(15, 23, 42, .04);
}

[data-aquila-overview-mgmt-r1="active"]
[data-aq-overview-tone="performance"] {
  border-top: 3px solid var(--aq-overview-green) !important;
}

[data-aquila-overview-mgmt-r1="active"]
[data-aq-overview-tone="liquidity"] {
  border-top: 3px solid var(--aq-overview-blue) !important;
}

[data-aquila-overview-mgmt-r1="active"]
[data-aq-overview-tone="working-capital"] {
  border-top: 3px solid var(--aq-overview-amber) !important;
}

[data-aquila-overview-mgmt-r1="active"]
[data-aq-overview-panel="performance"] {
  border-top: 3px solid var(--aq-overview-green) !important;
}

[data-aquila-overview-mgmt-r1="active"]
[data-aq-overview-panel="liquidity"] {
  border-top: 3px solid var(--aq-overview-blue) !important;
}

[data-aquila-overview-mgmt-r1="active"]
[data-aq-overview-panel="operations"] {
  border-top: 3px solid #475569 !important;
}

[data-aquila-overview-mgmt-r1="active"]
[data-aq-overview-panel="actions"] {
  border-top: 3px solid var(--aq-overview-violet) !important;
}

[data-aquila-overview-mgmt-r1="active"]
.finance-reference-v1__metric strong,
[data-aquila-overview-mgmt-r1="active"]
.finance-reference-v1__metric-card strong,
[data-aquila-overview-mgmt-r1="active"]
.finance-reference-v1__metric-value {
  color: var(--aq-overview-ink);
  font-variant-numeric: tabular-nums;
}

[data-aquila-overview-mgmt-r1="active"]
table {
  font-variant-numeric: tabular-nums;
}

@media (min-width: 1200px) {

  [data-aquila-overview-mgmt-r1="active"]
  .finance-reference-v1__metrics {
    grid-template-columns:
      repeat(4, minmax(0, 1fr)) !important;
  }

}

@media (min-width: 768px) and (max-width: 1199px) {

  [data-aquila-overview-mgmt-r1="active"]
  .finance-reference-v1__metrics {
    grid-template-columns:
      repeat(2, minmax(0, 1fr)) !important;
  }

}

@media (max-width: 767px) {

  [data-aquila-overview-mgmt-r1="active"]
  .aq-overview-mgmt-r1-banner {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
  }

  [data-aquila-overview-mgmt-r1="active"]
  .aq-overview-mgmt-r1-pills {
    justify-content: flex-start;
  }

  [data-aquila-overview-mgmt-r1="active"]
  .finance-reference-v1__metrics {
    grid-template-columns:
      minmax(0, 1fr) !important;
  }

}

@media (max-width: 430px) {

  [data-aquila-overview-mgmt-r1="active"]
  .aq-overview-mgmt-r1-banner {
    margin-bottom: 14px;
    padding: 14px;
  }

  [data-aquila-overview-mgmt-r1="active"]
  .aq-overview-mgmt-r1-pills {
    gap: 6px;
  }

  [data-aquila-overview-mgmt-r1="active"]
  .aq-overview-mgmt-r1-pill {
    min-height: 28px;
    padding: 4px 8px;
    font-size: 10px;
  }

}
`;

        (
          document.head
          ||
          document.documentElement
        ).appendChild(
          style
        );
      }


      /*
       * ----------------------------------------------------------
       * MANAGEMENT CONTEXT BANNER
       * ----------------------------------------------------------
       */

      let banner =
        overview.querySelector(
          '[data-aquila-overview-mgmt-r1-banner="1"]'
        );


      if (
        !banner
      ) {

        banner =
          document.createElement(
            'section'
          );

        banner.className =
          'aq-overview-mgmt-r1-banner';

        banner.setAttribute(
          'data-aquila-overview-mgmt-r1-banner',
          '1'
        );

        banner.setAttribute(
          'aria-label',
          'Finance management snapshot'
        );

        banner.innerHTML = `
<div class="aq-overview-mgmt-r1-copy">
  <p class="aq-overview-mgmt-r1-eyebrow">Finance Overview</p>
  <h2 class="aq-overview-mgmt-r1-title">Management snapshot</h2>
  <p class="aq-overview-mgmt-r1-subtitle">
    A live view of performance, liquidity and working capital from the existing Finance records.
  </p>
</div>
<div class="aq-overview-mgmt-r1-pills" aria-label="Management focus">
  <span class="aq-overview-mgmt-r1-pill">Performance</span>
  <span class="aq-overview-mgmt-r1-pill">Liquidity</span>
  <span class="aq-overview-mgmt-r1-pill">Working capital</span>
</div>
`;

        const header =
          overview.querySelector(
            '.finance-reference-v1__header'
          );

        const metrics =
          overview.querySelector(
            '.finance-reference-v1__metrics'
          );


        if (
          header
          &&
          header.parentNode
        ) {

          header.insertAdjacentElement(
            'afterend',
            banner
          );

        } else if (
          metrics
          &&
          metrics.parentNode
        ) {

          metrics.parentNode.insertBefore(
            banner,
            metrics
          );

        } else {

          overview.prepend(
            banner
          );

        }
      }


      /*
       * ----------------------------------------------------------
       * SEMANTIC KPI PRESENTATION
       *
       * Values are never changed.
       * Only an existing card's presentation category is tagged.
       * ----------------------------------------------------------
       */

      const metricCards =
        overview.querySelectorAll(
          [
            '.finance-reference-v1__metric',
            '.finance-reference-v1__metric-card'
          ].join(',')
        );


      metricCards.forEach(
        function(
          card
        ) {

          card.removeAttribute(
            'data-aq-overview-tone'
          );

          const text =
            String(
              card.textContent
              ||
              ''
            )
            .replace(
              /\s+/g,
              ' '
            )
            .trim()
            .toLowerCase();


          if (
            text.includes(
              'total revenue'
            )
            ||
            text.includes(
              'gross margin'
            )
            ||
            text.includes(
              'total expenses'
            )
            ||
            text.includes(
              'net profit'
            )
          ) {

            card.setAttribute(
              'data-aq-overview-tone',
              'performance'
            );

            return;
          }


          if (
            text.includes(
              'cash in hand'
            )
            ||
            text.includes(
              'cash on hand'
            )
          ) {

            card.setAttribute(
              'data-aq-overview-tone',
              'liquidity'
            );

            return;
          }


          if (
            text.includes(
              'receivable'
            )
            ||
            text.includes(
              'accounts payable'
            )
            ||
            text.includes(
              'account payable'
            )
            ||
            text.includes(
              'inventory value'
            )
          ) {

            card.setAttribute(
              'data-aq-overview-tone',
              'working-capital'
            );

          }

        }
      );


      /*
       * ----------------------------------------------------------
       * SEMANTIC MANAGEMENT PANELS
       *
       * Existing sections, charts, rows, links and actions remain
       * untouched. Only presentation category tags are added.
       * ----------------------------------------------------------
       */

      const panels =
        overview.querySelectorAll(
          [
            '.finance-reference-v1__panel',
            '.finance-reference-v1__bank-accounts'
          ].join(',')
        );


      panels.forEach(
        function(
          panel
        ) {

          panel.removeAttribute(
            'data-aq-overview-panel'
          );


          const heading =
            panel.querySelector(
              'h2,h3,h4'
            );


          const text =
            String(
              (
                heading
                ?
                heading.textContent
                :
                panel.textContent
              )
              ||
              ''
            )
            .replace(
              /\s+/g,
              ' '
            )
            .trim()
            .toLowerCase();


          if (
            text.includes(
              'revenue vs expenses'
            )
            ||
            text.includes(
              'profit and loss'
            )
            ||
            text.includes(
              'profit & loss'
            )
            ||
            text.includes(
              'expense breakdown'
            )
          ) {

            panel.setAttribute(
              'data-aq-overview-panel',
              'performance'
            );

            return;
          }


          if (
            text.includes(
              'cash flow'
            )
            ||
            text.includes(
              'bank accounts'
            )
            ||
            text.includes(
              'bank & cash'
            )
            ||
            text.includes(
              'bank and cash'
            )
          ) {

            panel.setAttribute(
              'data-aq-overview-panel',
              'liquidity'
            );

            return;
          }


          if (
            text.includes(
              'recent transactions'
            )
            ||
            text.includes(
              'top receivables'
            )
            ||
            text.includes(
              'upcoming payables'
            )
          ) {

            panel.setAttribute(
              'data-aq-overview-panel',
              'operations'
            );

            return;
          }


          if (
            text.includes(
              'quick actions'
            )
            ||
            text.includes(
              'report shortcuts'
            )
          ) {

            panel.setAttribute(
              'data-aq-overview-panel',
              'actions'
            );

          }

        }
      );


      return true;

    } catch (_) {

      /*
       * Presentation must never break the authoritative Finance
       * Overview or another Finance workspace.
       */

      return false;
    }
  }

  /*
   * AQUILA_FINANCE_OVERVIEW_MANAGEMENT_R1_END
   */

  async function applyOverview(
    root,
    auth,
  ) {
    const currentRange =
      currentMonthRange();

    const revenuePanel =
      panelByTitle(
        root,
        [
          'Revenue vs Expenses',
          'Revenue vs Expenses Trend',
        ],
      )
      || q(
        '.finance-reference-v1__panel--revenue',
        root,
      );

    const cashPanel =
      panelByTitle(
        root,
        [
          'Cash Flow Overview',
        ],
      )
      || q(
        '.finance-reference-v1__panel--cash-flow',
        root,
      );

    const revenueRange =
      monthRange(
        selectedMonths(
          revenuePanel,
          6,
        ),
      );

    const cashRange =
      monthRange(
        selectedMonths(
          cashPanel,
          6,
        ),
      );

    const [
      overview,
      receivables,
      profitLoss,
      cashFlow,
    ] =
      await Promise.all([
        getJson(
          commercialUrl(
            'overview',
            currentRange,
          ),
          auth,
        ),

        getJson(
          commercialUrl(
            'receivables',
            currentRange,
          ),
          auth,
        ),

        getJson(
          commercialUrl(
            'profit-loss',
            revenueRange,
          ),
          auth,
        ),

        getJson(
          commercialUrl(
            'cash-flow',
            cashRange,
          ),
          auth,
        ),
      ]);

    if (
      overview.ok
    ) {
      renderRecent(
        root,
        rowsFrom(
          overview.payload,
        ),
      );
    }

    if (
      receivables.ok
    ) {
      renderReceivables(
        root,
        rowsFrom(
          receivables.payload,
        ),
        currentRange,
      );
    }

    if (
      profitLoss.ok
      && revenuePanel
    ) {
      renderChart(
        revenuePanel,
        seriesFrom(
          profitLoss.payload,
        ),
        [
          {
            value:
              incomeValue,

            colour:
              '#16a34a',
          },

          {
            value:
              expenseValue,

            colour:
              '#dc2626',
          },

          {
            value:
              pnlNetValue,

            colour:
              '#2563eb',
          },
        ],
        'monthly',
        revenueRange,
      );
    }

    if (
      cashFlow.ok
      && cashPanel
    ) {
      renderChart(
        cashPanel,
        seriesFrom(
          cashFlow.payload,
        ),
        [
          {
            value:
              cashInValue,

            colour:
              '#16a34a',
          },

          {
            value:
              cashOutValue,

            colour:
              '#dc2626',
          },

          {
            value:
              cashNetValue,

            colour:
              '#2563eb',
          },
        ],
        'monthly',
        cashRange,
      );
    }
  }


  async function applyProfitLoss(
    root,
    auth,
  ) {
    const range =
      detailRange(
        root,
      );

    const response =
      await getJson(
        commercialUrl(
          'profit-loss',
          range,
        ),
        auth,
      );

    if (
      !response.ok
    ) {
      return;
    }

    const series =
      seriesFrom(
        response.payload,
      );

    const comparison =
      panelByTitle(
        root,
        [
          'Income vs Expenses',
        ],
      );

    const net =
      panelByTitle(
        root,
        [
          'Net Profit Trend',
        ],
      );

    if (
      comparison
    ) {
      renderChart(
        comparison,
        series,
        [
          {
            value:
              incomeValue,

            colour:
              '#16a34a',
          },

          {
            value:
              expenseValue,

            colour:
              '#dc2626',
          },
        ],
        'daily',
        range,
      );
    }

    if (
      net
    ) {
      renderChart(
        net,
        series,
        [
          {
            value:
              pnlNetValue,

            colour:
              '#2563eb',
          },
        ],
        'daily',
        range,
      );
    }
  }


  async function applyCashFlow(
    root,
    auth,
  ) {
    const range =
      detailRange(
        root,
      );

    const response =
      await getJson(
        commercialUrl(
          'cash-flow',
          range,
        ),
        auth,
      );

    if (
      !response.ok
    ) {
      return;
    }

    const series =
      seriesFrom(
        response.payload,
      );

    const comparison =
      panelByTitle(
        root,
        [
          'Cash Inflow vs Cash Outflow',
        ],
      );

    const net =
      panelByTitle(
        root,
        [
          'Net Cash Flow Trend',
        ],
      );

    if (
      comparison
    ) {
      renderChart(
        comparison,
        series,
        [
          {
            value:
              cashInValue,

            colour:
              '#16a34a',
          },

          {
            value:
              cashOutValue,

            colour:
              '#dc2626',
          },
        ],
        'daily',
        range,
      );
    }

    if (
      net
    ) {
      renderChart(
        net,
        series,
        [
          {
            value:
              cashNetValue,

            colour:
              '#2563eb',
          },
        ],
        'daily',
        range,
      );
    }
  }




  /*
   * ============================================================
   * AQUILA_SALES_CASHFLOW_TABLE_STANDARD_R1I_BEGIN
   *
   * Browser/source-proven lifecycle:
   *
   *   The existing R2.9.1 Sales renderer completes first.
   *   The management table enhancer then runs once.
   *
   * Existing Sales Performance table is reused in place.
   * No duplicate Sales renderer or table.
   * ============================================================
   */

  const AQ_SALES_R1I_STYLE_ID =
    'aquila-sales-cashflow-table-r1i-style';


  function aqSalesR1iClean(
    value
  ) {
    return String(
      value
      ??
      ''
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();
  }


  function aqSalesR1iNormalize(
    value
  ) {
    return aqSalesR1iClean(
      value
    ).toLowerCase();
  }


  function aqSalesR1iNumber(
    value
  ) {
    if (
      value === null
      ||
      value === undefined
      ||
      value === ''
    ) {
      return null;
    }

    const numeric =
      Number(
        value
      );

    return Number.isFinite(
      numeric
    )
      ?
      numeric
      :
      null;
  }


  function aqSalesR1iMoney(
    value
  ) {
    const numeric =
      aqSalesR1iNumber(
        value
      );

    if (
      numeric === null
    ) {
      return '—';
    }

    const absolute =
      new Intl.NumberFormat(
        'en-RW',
        {
          minimumFractionDigits:
            0,

          maximumFractionDigits:
            2,
        }
      ).format(
        Math.abs(
          numeric
        )
      );

    return (
      numeric < 0
        ?
        'RWF -'
        :
        'RWF '
    )
      +
      absolute;
  }


  function aqSalesR1iDate(
    value
  ) {
    const text =
      String(
        value
        ||
        ''
      );

    if (
      !/^\d{4}-\d{2}-\d{2}$/
        .test(
          text
        )
    ) {
      return null;
    }

    const date =
      new Date(
        text
        +
        'T00:00:00Z'
      );

    return Number.isNaN(
      date.getTime()
    )
      ?
      null
      :
      date;
  }


  function aqSalesR1iIso(
    date
  ) {
    return (
      String(
        date.getUTCFullYear()
      )
      +
      '-'
      +
      String(
        date.getUTCMonth()
        +
        1
      ).padStart(
        2,
        '0'
      )
      +
      '-'
      +
      String(
        date.getUTCDate()
      ).padStart(
        2,
        '0'
      )
    );
  }


  function aqSalesR1iMonthLabel(
    date
  ) {
    return new Intl.DateTimeFormat(
      'en-RW',
      {
        month:
          'short',

        year:
          'numeric',

        timeZone:
          'UTC',
      }
    )
      .format(
        date
      )
      .toUpperCase();
  }


  function aqSalesR1iCurrentRange(
    root
  ) {
    const range =
      detailRange(
        root
      );

    const from =
      String(
        range?.from
        ??
        range?.start_date
        ??
        range?.date_from
        ??
        ''
      );

    const to =
      String(
        range?.to
        ??
        range?.end_date
        ??
        range?.date_to
        ??
        ''
      );

    if (
      !aqSalesR1iDate(
        from
      )
      ||
      !aqSalesR1iDate(
        to
      )
    ) {
      return null;
    }

    return {
      ...range,
      from,
      to,
    };
  }


  function aqSalesR1iHistoricalPeriods(
    currentRange
  ) {
    const from =
      aqSalesR1iDate(
        currentRange?.from
      );

    if (!from) {
      return [];
    }

    const periods = [];

    /*
     * The native table already contains previous month.
     * Historical sequence therefore starts two months before
     * the selected current month.
     */
    for (
      let offset = 2;
      offset <= 7;
      offset += 1
    ) {
      const start =
        new Date(
          Date.UTC(
            from.getUTCFullYear(),
            from.getUTCMonth()
            -
            offset,
            1
          )
        );

      const end =
        new Date(
          Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth()
            +
            1,
            0
          )
        );

      periods.push(
        {
          from:
            aqSalesR1iIso(
              start
            ),

          to:
            aqSalesR1iIso(
              end
            ),

          label:
            aqSalesR1iMonthLabel(
              start
            ),
        }
      );
    }

    return periods;
  }


  function aqSalesR1iRequest(
    base,
    period
  ) {
    return {
      ...(
        base
        &&
        typeof base === 'object'
          ?
          base
          :
          {}
      ),

      from:
        period.from,

      to:
        period.to,

      start_date:
        period.from,

      end_date:
        period.to,

      date_from:
        period.from,

      date_to:
        period.to,

      business_date_from:
        period.from,

      business_date_to:
        period.to,

      page:
        1,

      per_page:
        200,
    };
  }


  function aqSalesR1iPayload(
    source
  ) {
    let value =
      source;

    for (
      let depth = 0;
      depth < 6;
      depth += 1
    ) {
      if (
        !value
        ||
        typeof value !== 'object'
      ) {
        return null;
      }

      if (
        Array.isArray(
          value.summary
        )
      ) {
        return value;
      }

      if (
        value.payload
        &&
        typeof value.payload === 'object'
        &&
        value.payload !== value
      ) {
        value =
          value.payload;

        continue;
      }

      if (
        value.data
        &&
        typeof value.data === 'object'
        &&
        value.data !== value
      ) {
        value =
          value.data;

        continue;
      }

      break;
    }

    return (
      value
      &&
      Array.isArray(
        value.summary
      )
    )
      ?
      value
      :
      null;
  }


  function aqSalesR1iMetric(
    source,
    keys
  ) {
    const payload =
      aqSalesR1iPayload(
        source
      );

    if (!payload) {
      return null;
    }

    const wanted =
      keys.map(
        aqSalesR1iNormalize
      );

    const row =
      payload.summary.find(
        item => {

          const candidates = [
            item?.key,
            item?.code,
            item?.id,
            item?.name,
            item?.label,
          ]
            .map(
              aqSalesR1iNormalize
            )
            .filter(
              Boolean
            );

          return wanted.some(
            key =>
              candidates.includes(
                key
              )
          );
        }
      );

    if (!row) {
      return null;
    }

    for (
      const candidate
      of [
        row.value,
        row.amount,
        row.total,
      ]
    ) {
      const numeric =
        aqSalesR1iNumber(
          candidate
        );

      if (
        numeric !== null
      ) {
        return numeric;
      }
    }

    return null;
  }


  function aqSalesR1iRefundTotal(
    refunds
  ) {
    if (
      !(refunds instanceof Map)
    ) {
      return null;
    }

    let total = 0;
    let found = false;

    for (
      const value
      of refunds.values()
    ) {
      const direct =
        aqSalesR1iNumber(
          value
        );

      if (
        direct !== null
      ) {
        total += direct;
        found = true;
        continue;
      }

      if (
        value
        &&
        typeof value === 'object'
      ) {
        for (
          const candidate
          of [
            value.amount,
            value.total,
            value.value,
            value.refund_amount,
            value.approved_refund_amount,
          ]
        ) {
          const numeric =
            aqSalesR1iNumber(
              candidate
            );

          if (
            numeric !== null
          ) {
            total += numeric;
            found = true;
            break;
          }
        }
      }
    }

    return found
      ?
      total
      :
      null;
  }


  async function aqSalesR1iHistoricalRead(
    base,
    period,
    auth
  ) {
    const request =
      aqSalesR1iRequest(
        base,
        period
      );

    const [
      salesResponse,
      refunds,
    ] =
      await Promise.all([
        getJson(
          commercialUrl(
            'sales',
            request
          ),
          auth
        ).catch(
          () =>
            null
        ),

        refundMap(
          request,
          auth
        ).catch(
          () =>
            null
        ),
      ]);

    let salesTotal =
      null;

    if (
      salesResponse
      &&
      salesResponse.ok
    ) {
      salesTotal =
        aqSalesR1iMetric(
          salesResponse.payload,
          [
            'sales_total',
            'sales value',
            'sales total',
          ]
        );
    }

    return {
      ...period,

      salesTotal,

      returnsTotal:
        aqSalesR1iRefundTotal(
          refunds
        ),
    };
  }


  function aqSalesR1iFindPanel(
    root
  ) {
    const headings =
      Array.from(
        root.querySelectorAll(
          'h1,h2,h3,h4,h5'
        )
      );

    const heading =
      headings.find(
        item =>
          aqSalesR1iNormalize(
            item.textContent
          )
          ===
          'sales performance'
      );

    if (!heading) {
      return null;
    }

    let node =
      heading.parentElement;

    while (
      node
      &&
      node !== root
    ) {
      if (
        node.querySelector(
          'table'
        )
      ) {
        return node;
      }

      node =
        node.parentElement;
    }

    return null;
  }


  function aqSalesR1iHistoricalValue(
    label,
    item
  ) {
    const normalized =
      aqSalesR1iNormalize(
        label
      );

    if (
      normalized === 'total sales'
      ||
      normalized === 'sales total'
    ) {
      return aqSalesR1iMoney(
        item.salesTotal
      );
    }

    if (
      normalized === 'returns / voids'
      ||
      normalized === 'returns/voids'
      ||
      normalized === 'returns & voids'
    ) {
      return aqSalesR1iMoney(
        item.returnsTotal
      );
    }

    /*
     * Historical splits not independently proven by the
     * authoritative read model remain unavailable.
     */
    return '—';
  }


  function aqSalesR1iEnsureStyle() {
    if (
      document.getElementById(
        AQ_SALES_R1I_STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style'
      );

    style.id =
      AQ_SALES_R1I_STYLE_ID;

    style.textContent = `
      .finance-sales-v1 .aq-sales-r1i-scroll {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .finance-sales-v1 .aq-sales-r1i-table {
        width: 100%;
        min-width: 1600px;
        table-layout: auto !important;
        border-collapse: separate;
        border-spacing: 0;
      }

      .finance-sales-v1 .aq-sales-r1i-table th,
      .finance-sales-v1 .aq-sales-r1i-table td {
        padding: 10px 12px;
        border-right: 1px solid #dfe6ec;
        border-bottom: 1px solid #dfe6ec;
        font-size: 12px;
        vertical-align: middle;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }

      .finance-sales-v1 .aq-sales-r1i-table thead th {
        background: #f8fafc;
        color: #53667e;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .04em;
        white-space: nowrap;
      }

      .finance-sales-v1 .aq-sales-r1i-particulars {
        position: sticky;
        left: 0;
        z-index: 2;
        min-width: 260px;
        width: 260px;
        text-align: left;
      }

      .finance-sales-v1 thead
      .aq-sales-r1i-particulars {
        z-index: 4;
        background: #f8fafc;
      }

      .finance-sales-v1 tbody
      .aq-sales-r1i-particulars {
        background: #ffffff;
      }

      .finance-sales-v1 .aq-sales-r1i-current {
        background: #eef8f3 !important;
      }

      .finance-sales-v1 thead
      .aq-sales-r1i-current {
        border-top: 2px solid #82bea4;
      }

      .finance-sales-v1 .aq-sales-r1i-previous {
        background: #eef4fb !important;
      }

      .finance-sales-v1 thead
      .aq-sales-r1i-previous {
        border-top: 2px solid #9eb8d8;
      }

      .finance-sales-v1 .aq-sales-r1i-change,
      .finance-sales-v1 .aq-sales-r1i-change-pct {
        background: #f7f2ea !important;
      }

      .finance-sales-v1 thead
      .aq-sales-r1i-change,
      .finance-sales-v1 thead
      .aq-sales-r1i-change-pct {
        border-top: 2px solid #d8b98d;
      }

      .finance-sales-v1 .aq-sales-r1i-history {
        min-width: 100px;
        background: #ffffff;
        white-space: nowrap !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }

      .finance-sales-v1 .aq-sales-r1i-current,
      .finance-sales-v1 .aq-sales-r1i-previous {
        min-width: 190px;
        white-space: nowrap !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }

      .finance-sales-v1 .aq-sales-r1i-change {
        min-width: 130px;
        white-space: nowrap !important;
      }

      .finance-sales-v1 .aq-sales-r1i-change-pct {
        min-width: 110px;
        white-space: nowrap !important;
      }

      .finance-sales-v1 .aq-sales-r1i-table
      thead th:not(.aq-sales-r1i-particulars),
      .finance-sales-v1 .aq-sales-r1i-table
      tbody td {
        text-align: right;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }

      .finance-sales-v1 .aq-sales-r1i-section {
        position: static !important;
        background: #f8fafc !important;
        color: #1f2b3d !important;
        font-weight: 800 !important;
        text-align: left !important;
        text-transform: uppercase;
      }

      @media (max-width: 768px) {
        .finance-sales-v1 .aq-sales-r1i-table {
          min-width: 1600px;
        }

        .finance-sales-v1 .aq-sales-r1i-particulars {
          min-width: 220px;
          width: 220px;
        }
      }

      @media (max-width: 430px) {
        .finance-sales-v1 .aq-sales-r1i-table {
          min-width: 1600px;
        }

        .finance-sales-v1 .aq-sales-r1i-particulars {
          min-width: 190px;
          width: 190px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }


  async function aqSalesR1k2EnhanceLiveTable(
    root,
    auth
  ) {
    let aqSalesR1k2LoadingKey =
      '';

    try {
      /*
       * ========================================================
       * AQUILA_SALES_R1K2_CONCURRENCY_GUARD_BEGIN
       * ========================================================
       */

      const aqSalesR1k2RouteAtStart =
        routeState();

      if (
        !aqSalesR1k2RouteAtStart
        ||
        aqSalesR1k2RouteAtStart.finance !== 'sales'
      ) {
        return false;
      }

      if (
        !root
        ||
        !root.isConnected
      ) {
        return false;
      }

      const panel =
        aqSalesR1iFindPanel(
          root
        );

      if (!panel) {
        return false;
      }

      const table =
        panel.querySelector(
          'table'
        );

      if (!table) {
        return false;
      }

      const headerRow =
        table.querySelector(
          'thead tr'
        );

      if (!headerRow) {
        return false;
      }

      const currentRange =
        aqSalesR1iCurrentRange(
          root
        );

      if (!currentRange) {
        return false;
      }

      const aqSalesR1k2RangeKey =
        currentRange.from
        +
        '|'
        +
        currentRange.to;

      /*
       * IDEMPOTENCY
       *
       * If the exact range is already committed with exactly
       * six generated historical headers, do nothing.
       */
      const aqSalesR1k2ExistingHistoryHeaders =
        headerRow.querySelectorAll(
          '[data-aquila-sales-r1i-history="1"]'
        ).length;

      if (
        table.dataset.aquilaSalesR1k2RangeKey
        ===
        aqSalesR1k2RangeKey
        &&
        aqSalesR1k2ExistingHistoryHeaders === 6
      ) {
        return true;
      }

      /*
       * SAME-RANGE IN-FLIGHT SUPPRESSION
       */
      if (
        root.dataset.aquilaSalesR1k2LoadingKey
        ===
        aqSalesR1k2RangeKey
      ) {
        return false;
      }

      root.dataset.aquilaSalesR1k2LoadingKey =
        aqSalesR1k2RangeKey;

      aqSalesR1k2LoadingKey =
        aqSalesR1k2RangeKey;

      /*
       * LATEST GENERATION WINS
       */
      const aqSalesR1k2Generation =
        String(
          (
            Number(
              root.dataset.aquilaSalesR1k2Generation
              ||
              '0'
            )
            ||
            0
          )
          +
          1
        );

      root.dataset.aquilaSalesR1k2Generation =
        aqSalesR1k2Generation;

      /*
       * Determine the native five-column contract while leaving
       * any currently visible history untouched until final
       * commit.
       */
      const baseHeaders =
        Array.from(
          headerRow.children
        ).filter(
          cell =>
            cell.matches(
              'th,td'
            )
            &&
            cell.getAttribute(
              'data-aquila-sales-r1i-history'
            )
            !==
            '1'
        );

      if (
        baseHeaders.length !== 5
      ) {
        return false;
      }

      const periods =
        aqSalesR1iHistoricalPeriods(
          currentRange
        );

      if (
        periods.length !== 6
      ) {
        return false;
      }

      const historical =
        await Promise.all(
          periods.map(
            period =>
              aqSalesR1iHistoricalRead(
                currentRange,
                period,
                auth
              )
          )
        );

      /*
       * A newer Sales run started while we were loading.
       */
      if (
        root.dataset.aquilaSalesR1k2Generation
        !==
        aqSalesR1k2Generation
      ) {
        return false;
      }

      /*
       * ROUTE CHECK IMMEDIATELY BEFORE COMMIT
       */
      const aqSalesR1k2RouteAtCommit =
        routeState();

      if (
        !aqSalesR1k2RouteAtCommit
        ||
        aqSalesR1k2RouteAtCommit.finance !== 'sales'
      ) {
        return false;
      }

      if (
        !root.isConnected
        ||
        !table.isConnected
      ) {
        return false;
      }

      /*
       * RANGE CHECK IMMEDIATELY BEFORE COMMIT
       */
      const aqSalesR1k2RangeAtCommit =
        aqSalesR1iCurrentRange(
          root
        );

      if (
        !aqSalesR1k2RangeAtCommit
        ||
        aqSalesR1k2RangeAtCommit.from !== currentRange.from
        ||
        aqSalesR1k2RangeAtCommit.to !== currentRange.to
      ) {
        return false;
      }

      /*
       * ========================================================
       * FINAL DOM COMMIT
       *
       * Remove generated history only after:
       *   - network completed
       *   - generation verified
       *   - route verified
       *   - range verified
       *
       * This prevents the R1J duplicate-column race.
       * ========================================================
       */

      table
        .querySelectorAll(
          '[data-aquila-sales-r1i-history="1"]'
        )
        .forEach(
          node =>
            node.remove()
        );

      const headers =
        Array.from(
          headerRow.children
        ).filter(
          cell =>
            cell.matches(
              'th,td'
            )
        );

      if (
        headers.length !== 5
      ) {
        return false;
      }

      headers[0]
        .classList
        .add(
          'aq-sales-r1i-particulars'
        );

      headers[1]
        .classList
        .add(
          'aq-sales-r1i-current'
        );

      headers[2]
        .classList
        .add(
          'aq-sales-r1i-previous'
        );

      headers[3]
        .classList
        .add(
          'aq-sales-r1i-change'
        );

      headers[4]
        .classList
        .add(
          'aq-sales-r1i-change-pct'
        );

      headers[0].textContent =
        'Particulars';

      headers[3].textContent =
        'Change';

      headers[4].textContent =
        '% Change';

      for (
        const item
        of historical
      ) {
        const th =
          document.createElement(
            'th'
          );

        th.className =
          'aq-sales-r1i-history';

        th.setAttribute(
          'data-aquila-sales-r1i-history',
          '1'
        );

        th.textContent =
          item.label;

        headerRow.appendChild(
          th
        );
      }

      /*
       * HARD HEADER INVARIANT:
       *
       * 5 native + 6 historical = exactly 11.
       */
      const aqSalesR1k2FinalHeaderCount =
        headerRow.querySelectorAll(
          'th,td'
        ).length;

      if (
        aqSalesR1k2FinalHeaderCount !== 11
      ) {
        table
          .querySelectorAll(
            '[data-aquila-sales-r1i-history="1"]'
          )
          .forEach(
            node =>
              node.remove()
          );

        return false;
      }

      const rows =
        Array.from(
          table.querySelectorAll(
            'tbody tr'
          )
        );

      for (
        const row
        of rows
      ) {
        const cells =
          Array.from(
            row.children
          ).filter(
            cell =>
              cell.matches(
                'th,td'
              )
          );

        if (!cells.length) {
          continue;
        }

        const first =
          cells[0];

        const sectionRow =
          cells.length === 1
          ||
          Number(
            first.colSpan
            ||
            1
          ) > 1;

        if (sectionRow) {
          first.colSpan =
            11;

          first.classList.add(
            'aq-sales-r1i-section'
          );

          continue;
        }

        if (
          cells.length < 5
        ) {
          continue;
        }

        first.classList.add(
          'aq-sales-r1i-particulars'
        );

        cells[1]
          .classList
          .add(
            'aq-sales-r1i-current'
          );

        cells[2]
          .classList
          .add(
            'aq-sales-r1i-previous'
          );

        cells[3]
          .classList
          .add(
            'aq-sales-r1i-change'
          );

        cells[4]
          .classList
          .add(
            'aq-sales-r1i-change-pct'
          );

        const label =
          aqSalesR1iClean(
            first.textContent
          );

        for (
          const item
          of historical
        ) {
          const td =
            document.createElement(
              'td'
            );

          td.className =
            'aq-sales-r1i-history';

          td.setAttribute(
            'data-aquila-sales-r1i-history',
            '1'
          );

          td.textContent =
            aqSalesR1iHistoricalValue(
              label,
              item
            );

          row.appendChild(
            td
          );
        }
      }

      /*
       * Every ordinary financial row must be 11 cells.
       */
      const malformedRows =
        Array.from(
          table.querySelectorAll(
            'tbody tr'
          )
        ).filter(
          row => {

            const cells =
              Array.from(
                row.children
              ).filter(
                cell =>
                  cell.matches(
                    'th,td'
                  )
              );

            if (!cells.length) {
              return false;
            }

            const first =
              cells[0];

            const sectionRow =
              cells.length === 1
              ||
              Number(
                first.colSpan
                ||
                1
              ) > 1;

            if (sectionRow) {
              return false;
            }

            return (
              cells.length !== 11
            );
          }
        );

      if (
        malformedRows.length
      ) {
        table
          .querySelectorAll(
            '[data-aquila-sales-r1i-history="1"]'
          )
          .forEach(
            node =>
              node.remove()
          );

        return false;
      }

      const scrollHost =
        table.parentElement;

      if (scrollHost) {
        scrollHost.classList.add(
          'aq-sales-r1i-scroll'
        );
      }

      aqSalesR1iEnsureStyle();

      table.classList.add(
        'aq-sales-r1i-table'
      );

      table.setAttribute(
        'data-aquila-sales-cashflow-standard',
        'r1k2'
      );

      table.dataset.aquilaSalesR1k2RangeKey =
        aqSalesR1k2RangeKey;

      panel.setAttribute(
        'data-aquila-sales-cashflow-standard',
        'r1k2'
      );

      root.setAttribute(
        'data-aquila-sales-cashflow-standard',
        'r1k2'
      );

      /*
       * ========================================================
       * AQUILA_SALES_R1K2_CONCURRENCY_GUARD_END
       * ========================================================
       */

      return true;

    } catch (_) {

      /*
       * Sales enhancement must never break the native workspace.
       */

      return false;

    } finally {

      /*
       * Clear only this invocation's own same-range lock.
       */
      if (
        root
        &&
        root.dataset
        &&
        aqSalesR1k2LoadingKey
        &&
        root.dataset.aquilaSalesR1k2LoadingKey
        ===
        aqSalesR1k2LoadingKey
      ) {
        delete root.dataset
          .aquilaSalesR1k2LoadingKey;
      }
    }
  }


  /*
   * AQUILA_SALES_CASHFLOW_TABLE_STANDARD_R1I_END
   */

  async function applySales(
    root,
    auth,
  ) {
let __aqSalesCapture=null;

    const range =
      detailRange(
        root,
      );

    const [
      response,
      refunds,
    ] =
      await Promise.all([
        getJson(
          commercialUrl(
            'sales',
            range,
          ),
          auth,
        ),

        refundMap(
          range,
          auth,
        ),
      ]);

    if (
      !response.ok
    ) {
      if(__aqSalesCapture)window.__AQUILA_FINANCE_NATIVE_DATA_R1__.publish("sales",__aqSalesCapture);return;
    }

    const series =
      seriesFrom(
        response.payload,
      );
__aqSalesCapture={payload:response.payload,series:series,refunds:refunds};


    const comparison =
      panelByTitle(
        root,
        [
          'Sales vs Returns',
        ],
      );

    const revenue =
      panelByTitle(
        root,
        [
          'Revenue Trend',
        ],
      );

    if (
      comparison
    ) {
      const definitions = [
        {
          value:
            incomeValue,

          colour:
            '#16a34a',
        },
      ];

      if (
        refunds
      ) {
        definitions.push(
          {
            value:
              (
                row,
              ) =>
                refunds.get(
                  rowDate(
                    row,
                  ),
                )
                || 0,

            colour:
              '#dc2626',

            hideZero:
              true,
          },
        );
      }

      renderChart(
        comparison,
        series,
        definitions,
        'daily',
        range,
      );
    }

    if (
      revenue
    ) {
      renderChart(
        revenue,
        series,
        [
          {
            value:
              incomeValue,

            colour:
              '#2563eb',
          },
        ],
        'daily',
        range,
      );
    }
  
if(__aqSalesCapture)window.__AQUILA_FINANCE_NATIVE_DATA_R1__.publish("sales",__aqSalesCapture);


}


  /* ============================================================
     APPLY
     ============================================================ */

  async function apply() {
    const route =
      routeState();

    if (
      route.section
      !== 'finance'
    ) {
      return false;
    }

    const started =
      performance.now();

    state.runs +=
      1;

    state.workspace =
      route.finance;

    state.chartsRendered =
      0;

    state.monthlyCharts =
      0;

    state.dailyCharts =
      0;

    state.valueLabels =
      0;

    state.dateLabels =
      0;

    state.horizontalScrollCharts =
      0;

    state.lastError =
      null;

    ensureStyle();
    lockDeck();

    const root =
      workspaceRoot(
        route.finance,
      );

    if (
      !root
    ) {
      state.lastError =
        'Finance workspace root is not mounted.';

      return false;
    }

    const auth =
      authContext();

    if (
      !auth
    ) {
      state.lastError =
        'Authenticated Admin session or tenant is unavailable.';

      return false;
    }

    try {
      if (
        route.finance
        === 'overview'
      ) {
        await applyOverview(
          root,
          auth,
        );

        aqOverviewMgmtR1Present(
          root
        );
      } else if (
        route.finance
        === 'financial-statements'
      ) {
        await applyProfitLoss(
          root,
          auth,
        );
      } else if (
        route.finance
        === 'cash-flow'
      ) {
        await applyCashFlow(
          root,
          auth,
        );
      } else if (
        route.finance
        === 'sales'
      ) {
        await applySales(
          root,
          auth,
        );

        void aqSalesR1k2EnhanceLiveTable(
          root,
          auth
        );

      } else {
        return false;
      }

      root.setAttribute(
        'data-aquila-finance-r2-9-1',
        'active',
      );

      state.lastAppliedAt =
        new Date()
          .toISOString();

      state.lastDurationMs =
        Math.round(
          performance.now()
          - started,
        );

      return true;
    } catch (
      error
    ) {
      state.lastError =
        String(
          error?.message
          ?? error,
        );

      return false;
    }
  }


  const api = {
    apply:
      () => apply(),

    diagnostics:
      () => ({
        ...state,

        route:
          routeState(),

        r28Coordinator:
          Boolean(
            window
              .__AQUILA_FINANCE_SEAMLESS_LOADING_R2_8__,
          ),

        presentationOverride:
          Boolean(
            window
              .__AQUILA_FINANCE_R2_7__
              ?.r291PresentationOwner,
          ),

        deck:
          q(
            '.ubuzima-glass-workspace-dock,'
            + '[data-ubuzima-workspace-dock]',
          )
            ? {
                found:
                  true,

                top:
                  getComputedStyle(
                    q(
                      '.ubuzima-glass-workspace-dock,'
                      + '[data-ubuzima-workspace-dock]',
                    ),
                  ).top,

                bottom:
                  getComputedStyle(
                    q(
                      '.ubuzima-glass-workspace-dock,'
                      + '[data-ubuzima-workspace-dock]',
                    ),
                  ).bottom,
              }
            : {
                found:
                  false,
              },
      }),
  };


  window
    .__AQUILA_FINANCE_R2_9_1__ =
    api;


  /*
   * THIS IS THE CORRECTED R2.9 STRATEGY.
   *
   * R2.8 already invokes R2.7's public presentation callable.
   * Replace ONLY that callable.
   *
   * No fragile parsing/rewrite of the R2.8 source block.
   */
  if (
    window
      .__AQUILA_FINANCE_R2_7__
    && typeof window
      .__AQUILA_FINANCE_R2_7__
      === 'object'
  ) {
    window
      .__AQUILA_FINANCE_R2_7__
      .apply =
      () =>
        api.apply();

    window
      .__AQUILA_FINANCE_R2_7__
      .r291PresentationOwner =
      true;
  }


  window
    .__AQUILA_FINANCE_R2_9_1_INSTALLED__ =
    true;

  ensureStyle();
  lockDeck();

  /*
   * No independent scheduler.
   * R2.8 remains the single loading coordinator.
   */
}());
(function () {
  'use strict';

  var VERSION = 'R2.9.2';

  var SPECS = [
    ['Revenue vs Expenses Trend', 'monthly'],
    ['Cash Flow Overview', 'monthly'],
    ['Income vs Expenses', 'daily'],
    ['Net Profit Trend', 'daily'],
    ['Cash Inflow vs Cash Outflow', 'daily'],
    ['Net Cash Flow Trend', 'daily'],
    ['Sales vs Returns', 'daily'],
    ['Revenue Trend', 'daily']
  ];

  function text(v) {
    return String(
      v == null ? '' : v
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  function visible(el) {
    if (
      !el ||
      !el.isConnected
    ) {
      return false;
    }

    var s =
      getComputedStyle(el);

    var r =
      el.getBoundingClientRect();

    return (
      s.display !== 'none' &&
      s.visibility !== 'hidden' &&
      r.width > 0 &&
      r.height > 0
    );
  }

  function exactHeading(title) {
    var nodes =
      document.querySelectorAll(
        'h1,h2,h3,h4,h5,h6,' +
        '[role="heading"],' +
        '.card-title,' +
        '.section-title,' +
        'div,span,p'
      );

    for (
      var i = 0;
      i < nodes.length;
      i += 1
    ) {
      if (
        visible(nodes[i]) &&
        text(
          nodes[i].textContent
        ) === title
      ) {
        return nodes[i];
      }
    }

    return null;
  }

  function cardFor(
    title,
    required
  ) {
    var h =
      exactHeading(title);

    var e = h;

    if (!h) {
      return null;
    }

    for (
      var i = 0;
      e && i < 10;
      i += 1,
      e = e.parentElement
    ) {
      if (!e.querySelector) {
        continue;
      }

      if (
        required
          ? e.querySelector(required)
          : e.querySelector(
              'svg,canvas,table'
            )
      ) {
        return e;
      }
    }

    return h.parentElement;
  }

  function ensureCss() {
    if (
      document.getElementById(
        'aquila-finance-r292-css'
      )
    ) {
      return;
    }

    var s =
      document.createElement(
        'style'
      );

    s.id =
      'aquila-finance-r292-css';

    s.textContent = [
      '[data-aquila-chart] .recharts-cartesian-grid{' +
      'display:none!important;' +
      'opacity:0!important}',

      '[data-aquila-chart] .recharts-xAxis,' +
      '[data-aquila-chart] .recharts-xAxis text,' +
      '[data-aquila-chart] .recharts-cartesian-axis-tick-value{' +
      'display:block!important;' +
      'opacity:1!important;' +
      'visibility:visible!important}',

      '.aquila-finance-chart-scroll{' +
      'overflow-x:auto!important;' +
      'overflow-y:hidden!important;' +
      'overscroll-behavior-x:contain}',

      '.aquila-finance-axis{' +
      'display:grid;' +
      'align-items:start;' +
      'font-size:11px;' +
      'line-height:1.2;' +
      'padding:5px 5px 2px;' +
      'box-sizing:border-box}',

      '.aquila-finance-axis span{' +
      'text-align:center;' +
      'white-space:nowrap;' +
      'padding:0 3px}',

      '[data-aquila-recent] table{' +
      'width:100%!important;' +
      'table-layout:fixed!important}',

      '[data-aquila-recent] th:nth-child(1),' +
      '[data-aquila-recent] td:nth-child(1){' +
      'width:11%!important}',

      '[data-aquila-recent] th:nth-child(2),' +
      '[data-aquila-recent] td:nth-child(2){' +
      'width:8%!important}',

      '[data-aquila-recent] th:nth-child(3),' +
      '[data-aquila-recent] td:nth-child(3){' +
      'width:33%!important;' +
      'white-space:nowrap!important;' +
      'overflow:hidden!important;' +
      'text-overflow:ellipsis!important}',

      '[data-aquila-recent] th:nth-child(4),' +
      '[data-aquila-recent] td:nth-child(4){' +
      'width:11%!important}',

      '[data-aquila-recent] th:nth-child(5),' +
      '[data-aquila-recent] td:nth-child(5){' +
      'width:18%!important}',

      '[data-aquila-recent] th:nth-child(6),' +
      '[data-aquila-recent] td:nth-child(6){' +
      'width:19%!important;' +
      'white-space:nowrap!important}',

      '[data-aquila-receivables] table{' +
      'width:100%!important;' +
      'table-layout:fixed!important}',

      '[data-aquila-receivables] th,' +
      '[data-aquila-receivables] td{' +
      'white-space:nowrap!important;' +
      'overflow:hidden!important;' +
      'text-overflow:ellipsis!important}',

      'html body .ubuzima-glass-workspace-dock,' +
      'html body [data-ubuzima-workspace-dock]{' +
      'position:fixed!important;' +
      'top:10px!important;' +
      'bottom:auto!important;' +
      'left:50%!important;' +
      'transform:translateX(-50%)!important;' +
      'margin:0!important}',

      '@media(max-width:767px){' +
      'html body .ubuzima-glass-workspace-dock,' +
      'html body [data-ubuzima-workspace-dock]{' +
      'top:6px!important;' +
      'bottom:auto!important}}'
    ].join('\n');

    document.head.appendChild(s);
  }

  function reactProps(el) {
    try {
      var keys =
        Object.keys(el);

      for (
        var i = 0;
        i < keys.length;
        i += 1
      ) {
        if (
          keys[i]
            .indexOf(
              '__reactProps$'
            ) === 0
        ) {
          return (
            el[keys[i]] ||
            {}
          );
        }
      }

      for (
        var j = 0;
        j < keys.length;
        j += 1
      ) {
        if (
          keys[j]
            .indexOf(
              '__reactFiber$'
            ) !== 0
        ) {
          continue;
        }

        var f =
          el[keys[j]];

        for (
          var d = 0;
          f && d < 8;
          d += 1,
          f = f.return
        ) {
          if (
            f.memoizedProps
          ) {
            return (
              f.memoizedProps
            );
          }
        }
      }
    } catch (_) {
      /* safe fallback */
    }

    return {};
  }

  function valueOf(el) {
    var p =
      reactProps(el);

    if (
      typeof p.value ===
        'number' &&
      isFinite(p.value)
    ) {
      return p.value;
    }

    if (p.payload) {
      if (
        p.dataKey &&
        typeof p.payload[
          p.dataKey
        ] === 'number'
      ) {
        return p.payload[
          p.dataKey
        ];
      }

      if (
        typeof p.payload
          .value === 'number'
      ) {
        return p.payload.value;
      }
    }

    return null;
  }

  function payloadOf(el) {
    var p =
      reactProps(el);

    return (
      p &&
      p.payload &&
      typeof p.payload ===
        'object'
    )
      ? p.payload
      : null;
  }

  function dateFromPayload(p) {
    if (!p) {
      return '';
    }

    var keys = [
      'date',
      'day',
      'period',
      'label',
      'name',
      'month',
      'transaction_date',
      'posting_date',
      'created_at'
    ];

    for (
      var i = 0;
      i < keys.length;
      i += 1
    ) {
      var v =
        text(
          p[keys[i]]
        );

      if (
        /\d{4}-\d{2}-\d{2}/
          .test(v) ||
        /[A-Za-z]{3,9}\s+\d{1,2}/
          .test(v) ||
        /[A-Za-z]{3,9}\s+\d{4}/
          .test(v)
      ) {
        return v;
      }
    }

    return '';
  }

  function fmt(v) {
    var a =
      Math.abs(v);

    if (
      a >= 1000000000
    ) {
      return (
        v / 1000000000
      )
        .toFixed(
          a >= 10000000000
            ? 0
            : 1
        )
        .replace(
          /\.0$/,
          ''
        ) + 'B';
    }

    if (
      a >= 1000000
    ) {
      return (
        v / 1000000
      )
        .toFixed(
          a >= 10000000
            ? 0
            : 1
        )
        .replace(
          /\.0$/,
          ''
        ) + 'M';
    }

    if (
      a >= 1000
    ) {
      return (
        v / 1000
      )
        .toFixed(
          a >= 10000
            ? 0
            : 1
        )
        .replace(
          /\.0$/,
          ''
        ) + 'K';
    }

    return String(
      Math.round(
        v * 100
      ) / 100
    );
  }

  function addLabels(card) {
    var svg =
      card.querySelector(
        'svg'
      );

    if (!svg) {
      return 0;
    }

    svg
      .querySelectorAll(
        '[data-aquila-value-label="1"]'
      )
      .forEach(
        function (x) {
          x.remove();
        }
      );

    var shapes =
      card.querySelectorAll(
        '.recharts-bar-rectangle path,' +
        '.recharts-bar-rectangle rect,' +
        '.recharts-line-dots circle,' +
        '.recharts-line-dot,' +
        '.recharts-scatter-symbol'
      );

    var count = 0;

    shapes.forEach(
      function (shape) {
        var v =
          valueOf(shape);

        if (
          v == null ||
          !isFinite(v) ||
          !shape.getBBox
        ) {
          return;
        }

        var b =
          shape.getBBox();

        if (
          !isFinite(b.x) ||
          !isFinite(b.y)
        ) {
          return;
        }

        var g =
          document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
          );

        g.setAttribute(
          'data-aquila-value-label',
          '1'
        );

        g.setAttribute(
          'pointer-events',
          'none'
        );

        var tx =
          document.createElementNS(
            'http://www.w3.org/2000/svg',
            'text'
          );

        tx.setAttribute(
          'x',
          b.x +
            b.width / 2
        );

        tx.setAttribute(
          'y',
          Math.max(
            12,
            b.y - 8
          )
        );

        tx.setAttribute(
          'text-anchor',
          'middle'
        );

        tx.setAttribute(
          'dominant-baseline',
          'middle'
        );

        tx.setAttribute(
          'fill',
          '#fff'
        );

        tx.setAttribute(
          'font-size',
          '10'
        );

        tx.setAttribute(
          'font-weight',
          '700'
        );

        tx.textContent =
          fmt(v);

        g.appendChild(tx);
        svg.appendChild(g);

        try {
          var bb =
            tx.getBBox();

          var r =
            document
              .createElementNS(
                'http://www.w3.org/2000/svg',
                'rect'
              );

          r.setAttribute(
            'x',
            bb.x - 4
          );

          r.setAttribute(
            'y',
            bb.y - 2
          );

          r.setAttribute(
            'width',
            bb.width + 8
          );

          r.setAttribute(
            'height',
            bb.height + 4
          );

          r.setAttribute(
            'rx',
            '3'
          );

          r.setAttribute(
            'fill',
            '#000'
          );

          g.insertBefore(
            r,
            tx
          );

          count += 1;
        } catch (_) {
          g.remove();
        }
      }
    );

    return count;
  }

  function nativeDates(card) {
    var out = [];

    card
      .querySelectorAll(
        '.recharts-xAxis text,' +
        '.recharts-xAxis ' +
        '.recharts-cartesian-axis-tick-value'
      )
      .forEach(
        function (e) {
          var t =
            text(
              e.textContent
            );

          if (
            t &&
            out.indexOf(t) < 0
          ) {
            out.push(t);
          }
        }
      );

    return out;
  }

  function payloadDates(card) {
    var out = [];

    card
      .querySelectorAll(
        '.recharts-bar-rectangle path,' +
        '.recharts-bar-rectangle rect,' +
        '.recharts-line-dots circle,' +
        '.recharts-line-dot,' +
        '.recharts-scatter-symbol'
      )
      .forEach(
        function (e) {
          var d =
            dateFromPayload(
              payloadOf(e)
            );

          if (
            d &&
            out.indexOf(d) < 0
          ) {
            out.push(d);
          }
        }
      );

    return out;
  }

  function selectedMonths() {
    var count = 6;

    document
      .querySelectorAll(
        'button,' +
        '[role="button"],' +
        '[role="option"],' +
        'option:checked'
      )
      .forEach(
        function (e) {
          if (
            e.tagName !==
              'OPTION' &&
            !visible(e)
          ) {
            return;
          }

          var m =
            text(
              e.textContent
            )
              .match(
                /^(\d{1,2})\s+Months?$/i
              );

          if (m) {
            count =
              Math.max(
                1,
                Math.min(
                  24,
                  parseInt(
                    m[1],
                    10
                  )
                )
              );
          }
        }
      );

    var now =
      new Date();

    var out = [];

    for (
      var i = count - 1;
      i >= 0;
      i -= 1
    ) {
      var d =
        new Date(
          now.getFullYear(),
          now.getMonth() - i,
          1
        );

      out.push(
        d.toLocaleDateString(
          undefined,
          {
            month: 'short',
            year: 'numeric'
          }
        )
      );
    }

    return out;
  }

  function axisAndScroll(
    card,
    granularity
  ) {
    var inner =
      card.querySelector(
        '.recharts-wrapper'
      ) ||
      card.querySelector(
        'svg'
      ) ||
      card.querySelector(
        'canvas'
      );

    if (!inner) {
      return {
        labels: 0,
        source: 'none',
        scroll: false
      };
    }

    var host =
      inner.parentElement &&
      card.contains(
        inner.parentElement
      )
        ? inner.parentElement
        : card;

    var left =
      host.scrollLeft || 0;

    host.classList.add(
      'aquila-finance-chart-scroll'
    );

    var old =
      host.querySelector(
        '.aquila-finance-axis'
      );

    if (old) {
      old.remove();
    }

    var labels =
      nativeDates(card);

    var source =
      'native';

    if (
      labels.length < 2
    ) {
      labels =
        payloadDates(card);

      source =
        labels.length
          ? 'genuine-payload'
          : 'none';
    }

    if (
      granularity ===
        'monthly' &&
      labels.length < 2
    ) {
      labels =
        selectedMonths();

      source =
        'selected-month-window';
    }

    var width =
      Math.max(
        Math.round(
          card
            .getBoundingClientRect()
            .width || 0
        ),
        labels.length *
          (
            granularity ===
              'monthly'
              ? 105
              : 78
          )
      );

    if (
      labels.length &&
      inner.style
    ) {
      inner.style.minWidth =
        width + 'px';
    }

    if (
      source !== 'native' &&
      labels.length
    ) {
      var strip =
        document.createElement(
          'div'
        );

      strip.className =
        'aquila-finance-axis';

      strip.setAttribute(
        'data-axis-source',
        source
      );

      strip.style
        .gridTemplateColumns =
          'repeat(' +
          labels.length +
          ',minmax(70px,1fr))';

      strip.style.minWidth =
        width + 'px';

      labels.forEach(
        function (t) {
          var s =
            document
              .createElement(
                'span'
              );

          s.textContent = t;

          strip.appendChild(s);
        }
      );

      host.appendChild(strip);
    }

    host.scrollLeft = left;

    return {
      labels:
        labels.length,

      source:
        source,

      scroll:
        host.scrollWidth >
        host.clientWidth + 2
    };
  }

  function applyChart(spec) {
    var card =
      cardFor(spec[0]);

    if (!card) {
      return {
        title: spec[0],
        found: false
      };
    }

    card.setAttribute(
      'data-aquila-chart',
      spec[0]
    );

    card.setAttribute(
      'data-aquila-granularity',
      spec[1]
    );

    var axis =
      axisAndScroll(
        card,
        spec[1]
      );

    var labels =
      addLabels(card);

    return {
      title: spec[0],
      found: true,
      granularity:
        spec[1],
      dataLabels:
        labels,
      xAxisLabels:
        axis.labels,
      xAxisSource:
        axis.source,
      horizontalScroll:
        axis.scroll,
      gridVisible:
        Array.prototype
          .some.call(
            card
              .querySelectorAll(
                '.recharts-cartesian-grid'
              ),
            visible
          )
    };
  }

  function fiveRows(
    table,
    marker
  ) {
    var p =
      table.parentElement;

    if (!p) {
      return false;
    }

    var top =
      p.scrollTop || 0;

    var rows =
      table.querySelectorAll(
        'tbody tr'
      );

    p.setAttribute(
      marker,
      '1'
    );

    if (
      rows.length > 5
    ) {
      var thead =
        table.querySelector(
          'thead'
        );

      var h =
        thead
          ? thead
              .getBoundingClientRect()
              .height
          : 42;

      for (
        var i = 0;
        i < 5;
        i += 1
      ) {
        h +=
          rows[i]
            .getBoundingClientRect()
            .height || 42;
      }

      p.style.maxHeight =
        Math.ceil(
          h + 2
        ) + 'px';

      p.style.overflowY =
        'auto';

      p.style.overflowX =
        'hidden';
    }

    p.scrollTop = top;

    return (
      p.scrollHeight >
      p.clientHeight + 2
    );
  }

  function recent() {
    var card =
      cardFor(
        'Recent Transactions',
        'table'
      );

    if (!card) {
      return {
        found: false
      };
    }

    var table =
      card.querySelector(
        'table'
      );

    if (!table) {
      return {
        found: false
      };
    }

    card.setAttribute(
      'data-aquila-recent',
      '1'
    );

    table
      .querySelectorAll(
        'tbody tr'
      )
      .forEach(
        function (r) {
          if (
            r.children.length >=
            3
          ) {
            var x =
              text(
                r.children[2]
                  .textContent
              );

            if (x) {
              r.children[2]
                .title = x;
            }
          }
        }
      );

    var hs =
      table.querySelectorAll(
        'thead th'
      );

    return {
      found: true,
      columns:
        hs.length,

      statusVisible:
        hs.length >= 6 &&
        /status/i.test(
          text(
            hs[5]
              .textContent
          )
        ),

      rows:
        table
          .querySelectorAll(
            'tbody tr'
          )
          .length,

      verticalScroll:
        fiveRows(
          table,
          'data-aquila-recent-scroll'
        )
    };
  }

  function ageing(v) {
    v = text(v);

    if (!v) {
      return '—';
    }

    if (
      /^\d+$/.test(v)
    ) {
      return v;
    }

    var d =
      new Date(v);

    if (
      isNaN(
        d.getTime()
      )
    ) {
      return '—';
    }

    var q =
      new Date();

    var a =
      Date.UTC(
        q.getFullYear(),
        q.getMonth(),
        q.getDate()
      );

    var b =
      Date.UTC(
        d.getFullYear(),
        d.getMonth(),
        d.getDate()
      );

    var days =
      Math.floor(
        (a - b) /
        86400000
      );

    return (
      days >= 0
        ? String(days)
        : '—'
    );
  }

  function receivables() {
    var card =
      cardFor(
        'Top Receivables',
        'table'
      );

    if (!card) {
      return {
        found: false
      };
    }

    var table =
      card.querySelector(
        'table'
      );

    if (!table) {
      return {
        found: false
      };
    }

    card.setAttribute(
      'data-aquila-receivables',
      '1'
    );

    var hs =
      Array.prototype
        .slice.call(
          table
            .querySelectorAll(
              'thead th'
            )
        );

    var names =
      hs.map(
        function (h) {
          return text(
            h.textContent
          ).toLowerCase();
        }
      );

    function idx(re) {
      for (
        var i = 0;
        i < names.length;
        i += 1
      ) {
        if (
          re.test(
            names[i]
          )
        ) {
          return i;
        }
      }

      return -1;
    }

    var ii =
      idx(
        /insurer|insurance|partner/
      );

    var ci =
      idx(
        /customer|patient|member|payer|client/
      );

    var oi =
      idx(
        /outstanding|balance|amount|receivable/
      );

    var ai =
      idx(
        /ageing|aging|days|issue.?date|transaction.?date|due.?date|date/
      );

    var safe =
      ci >= 0 &&
      oi >= 0 &&
      hs.length >= 4;

    if (safe) {
      table
        .querySelectorAll(
          'tbody tr'
        )
        .forEach(
          function (r) {
            var cells =
              Array.prototype
                .slice.call(
                  r.children
                );

            if (
              cells.length <
              hs.length
            ) {
              return;
            }

            var vals = [
              ii >= 0
                ? (
                    text(
                      cells[ii]
                        .textContent
                    ) ||
                    '—'
                  )
                : '—',

              text(
                cells[ci]
                  .textContent
              ) || '—',

              text(
                cells[oi]
                  .textContent
              ) || '—',

              ai >= 0
                ? ageing(
                    cells[ai]
                      .textContent
                  )
                : '—'
            ];

            for (
              var j = 0;
              j < 4;
              j += 1
            ) {
              cells[j]
                .textContent =
                vals[j];

              cells[j]
                .title =
                vals[j];

              cells[j]
                .style
                .display = '';
            }

            for (
              var k = 4;
              k < cells.length;
              k += 1
            ) {
              cells[k]
                .style
                .display =
                'none';
            }
          }
        );

      [
        'Insurer',
        'Customer',
        'Outstanding',
        'Ageing (Days)'
      ].forEach(
        function (v, i) {
          hs[i]
            .textContent = v;

          hs[i]
            .style
            .display = '';
        }
      );

      for (
        var h = 4;
        h < hs.length;
        h += 1
      ) {
        hs[h]
          .style
          .display =
          'none';
      }
    }

    return {
      found: true,
      mappingSafe:
        safe,
      sourceColumns:
        names,
      projectedFourColumns:
        safe,
      rows:
        table
          .querySelectorAll(
            'tbody tr'
          )
          .length,
      verticalScroll:
        fiveRows(
          table,
          'data-aquila-receivables-scroll'
        )
    };
  }

  function deck() {
    var docks =
      document.querySelectorAll(
        '.ubuzima-glass-workspace-dock,' +
        '[data-ubuzima-workspace-dock]'
      );

    docks.forEach(
      function (e) {
        e.style
          .setProperty(
            'top',
            innerWidth <= 767
              ? '6px'
              : '10px',
            'important'
          );

        e.style
          .setProperty(
            'bottom',
            'auto',
            'important'
          );

        e.style
          .setProperty(
            'left',
            '50%',
            'important'
          );

        e.style
          .setProperty(
            'transform',
            'translateX(-50%)',
            'important'
          );
      }
    );

    return docks.length;
  }

  function apply() {
    ensureCss();

    var y = scrollY;

    var charts =
      SPECS.map(
        applyChart
      );

    var r =
      recent();

    var q =
      receivables();

    var d =
      deck();

    if (
      scrollY !== y
    ) {
      scrollTo(
        scrollX,
        y
      );
    }

    API.last = {
      version:
        VERSION,
      charts:
        charts,
      recentTransactions:
        r,
      topReceivables:
        q,
      deckCount:
        d,
      appliedAt:
        new Date()
          .toISOString()
    };

    return API.last;
  }

  function diagnose() {
    var out = {
      version:
        VERSION,

      r27Callable:
        !!(
          window
            .__AQUILA_FINANCE_R2_7__ &&
          typeof window
            .__AQUILA_FINANCE_R2_7__
            .apply ===
            'function'
        ),

      charts: [],
      deck: [],

      recentTransactions:
        recent(),

      topReceivables:
        receivables(),

      lastApply:
        API.last
    };

    document
      .querySelectorAll(
        '.ubuzima-glass-workspace-dock,' +
        '[data-ubuzima-workspace-dock]'
      )
      .forEach(
        function (e) {
          var s =
            getComputedStyle(e);

          out.deck.push({
            top:
              s.top,
            bottom:
              s.bottom,
            position:
              s.position
          });
        }
      );

    SPECS.forEach(
      function (sp) {
        var card =
          cardFor(sp[0]);

        out.charts.push({
          title:
            sp[0],

          requiredGranularity:
            sp[1],

          found:
            !!card,

          dataLabels:
            card
              ? card
                  .querySelectorAll(
                    '[data-aquila-value-label="1"]'
                  )
                  .length
              : 0,

          gridVisible:
            card
              ? Array.prototype
                  .some.call(
                    card
                      .querySelectorAll(
                        '.recharts-cartesian-grid'
                      ),
                    visible
                  )
              : false,

          nativeXAxisLabels:
            card
              ? nativeDates(
                  card
                ).length
              : 0,

          generatedXAxisLabels:
            card
              ? card
                  .querySelectorAll(
                    '.aquila-finance-axis span'
                  )
                  .length
              : 0,

          horizontalScrollable:
            card
              ? Array.prototype
                  .some.call(
                    card
                      .querySelectorAll(
                        '.aquila-finance-chart-scroll'
                      ),
                    function (e) {
                      return (
                        e.scrollWidth >
                        e.clientWidth +
                          2
                      );
                    }
                  )
              : false
        });
      }
    );

    return out;
  }

  var r27 =
    window
      .__AQUILA_FINANCE_R2_7__;

  if (
    !r27 ||
    typeof r27.apply !==
      'function'
  ) {
    console.error(
      '[AQUILA FINANCE R2.9.2] ' +
      'R2.7 callable missing; ' +
      'override not activated.'
    );

    return;
  }

  var previous =
    r27.apply;

  if (
    previous &&
    previous
      .__aquilaFinanceR292 ===
      true
  ) {
    return;
  }

  var API =
    window
      .__AQUILA_FINANCE_BROWSER_REMEDIATION__ =
      {
        version:
          VERSION,
        last:
          null,
        previousApply:
          previous,
        applyPresentation:
          apply,
        diagnose:
          diagnose
      };

  function coordinated() {
    var result;

    try {
      result =
        previous.apply(
          this,
          arguments
        );
    } catch (e) {
      console.warn(
        '[AQUILA FINANCE R2.9.2] ' +
        'prior presentation apply failed',
        e
      );
    }

    apply();

    return result;
  }

  coordinated
    .__aquilaFinanceR292 =
    true;

  coordinated
    .__aquilaPreviousApply =
    previous;

  r27.apply =
    coordinated;

  /*
   * One immediate presentation pass.
   * Later passes remain owned by the
   * existing Finance coordinator.
   */
  apply();
})();
(function () {
  'use strict';

  var VERSION = 'R2.9.3';

  var MAX_ATTEMPTS = 8;

  var DELAYS = [
    0,
    50,
    100,
    180,
    280,
    420,
    650,
    900
  ];

  var GROUPS = [
    {
      key: 'overview',

      titles: [
        'Revenue vs Expenses Trend',
        'Cash Flow Overview'
      ],

      tables: [
        'Recent Transactions',
        'Top Receivables'
      ]
    },

    {
      key: 'profit-loss',

      titles: [
        'Income vs Expenses',
        'Net Profit Trend'
      ],

      tables: []
    },

    {
      key: 'cash-flow',

      titles: [
        'Cash Inflow vs Cash Outflow',
        'Net Cash Flow Trend'
      ],

      tables: []
    },

    {
      key: 'sales',

      titles: [
        'Sales vs Returns',
        'Revenue Trend'
      ],

      tables: []
    }
  ];

  function norm(v) {
    return String(
      v == null ? '' : v
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  function visible(el) {

    if (
      !el ||
      !el.isConnected
    ) {
      return false;
    }

    var s =
      getComputedStyle(el);

    var r =
      el.getBoundingClientRect();

    return (
      s.display !== 'none' &&
      s.visibility !== 'hidden' &&
      r.width > 0 &&
      r.height > 0
    );
  }

  function exactVisible(text) {

    var nodes =
      document.querySelectorAll(
        'h1,h2,h3,h4,h5,h6,' +
        '[role="heading"],' +
        '.card-title,' +
        '.section-title,' +
        'div,span,p'
      );

    for (
      var i = 0;
      i < nodes.length;
      i += 1
    ) {

      if (
        visible(nodes[i]) &&
        norm(
          nodes[i].textContent
        ) === text
      ) {
        return nodes[i];
      }

    }

    return null;
  }

  function routeKey() {

    var raw =
      String(
        location.hash || ''
      )
        .replace(
          /^#/,
          ''
        );

    var stableHash =
      raw
        .split('&')
        .filter(
          function (part) {

            return !/^scrollY=/i
              .test(part);

          }
        )
        .join('&');

    return (
      location.pathname +
      '|' +
      location.search +
      '|' +
      stableHash
    );
  }

  function financeRouteLikely() {

    var h =
      String(
        location.hash || ''
      );

    return (
      /(?:^|[&#])section=finance(?:&|$)/i
        .test(h) ||

      /(?:^|[&#])finance=/i
        .test(h) ||

      !!activeGroup()
    );
  }

  function activeGroup() {

    var partial =
      null;

    for (
      var i = 0;
      i < GROUPS.length;
      i += 1
    ) {

      var g =
        GROUPS[i];

      var found = 0;

      for (
        var j = 0;
        j < g.titles.length;
        j += 1
      ) {

        if (
          exactVisible(
            g.titles[j]
          )
        ) {
          found += 1;
        }

      }

      for (
        var k = 0;
        k < g.tables.length;
        k += 1
      ) {

        if (
          exactVisible(
            g.tables[k]
          )
        ) {
          found += 1;
        }

      }

      var total =
        g.titles.length +
        g.tables.length;

      if (
        found === total
      ) {

        return {
          group: g,
          found: found,
          total: total,
          complete: true
        };

      }

      if (
        found > 0 &&
        (
          !partial ||
          found > partial.found
        )
      ) {

        partial = {
          group: g,
          found: found,
          total: total,
          complete: false
        };

      }

    }

    return partial;
  }

  function presentationApi() {

    var api =
      window
        .__AQUILA_FINANCE_BROWSER_REMEDIATION__;

    if (
      !api ||
      typeof api
        .applyPresentation !==
        'function'
    ) {
      return null;
    }

    return api;
  }

  function markerState(group) {

    if (!group) {

      return {
        ready: false,
        charts: 0,
        tables: 0
      };

    }

    var charts = 0;
    var tables = 0;

    for (
      var i = 0;
      i < group.titles.length;
      i += 1
    ) {

      if (
        document.querySelector(
          '[data-aquila-chart="' +
          group.titles[i]
            .replace(
              /"/g,
              '\\"'
            ) +
          '"]'
        )
      ) {
        charts += 1;
      }

    }

    if (
      group.key === 'overview'
    ) {

      if (
        document.querySelector(
          '[data-aquila-recent="1"]'
        )
      ) {
        tables += 1;
      }

      if (
        document.querySelector(
          '[data-aquila-receivables="1"]'
        )
      ) {
        tables += 1;
      }

    }

    return {
      ready:
        charts ===
          group.titles.length &&
        tables ===
          group.tables.length,

      charts:
        charts,

      tables:
        tables
    };
  }

  var state =
    window
      .__AQUILA_FINANCE_LOADING_SETTLE__ ||
    {
      version: VERSION,
      timer: null,
      generation: 0,
      attempts: 0,
      route: '',
      settledRoute: '',
      exhaustedRoute: '',
      lastReason: '',
      lastResult: null,
      lastError: null
    };

  state.version =
    VERSION;

  window
    .__AQUILA_FINANCE_LOADING_SETTLE__ =
    state;

  function cancelTimer() {

    if (
      state.timer != null
    ) {

      clearTimeout(
        state.timer
      );

      state.timer =
        null;

    }
  }

  function finishReady(
    info,
    result
  ) {

    cancelTimer();

    state.settledRoute =
      state.route;

    state.exhaustedRoute =
      '';

    state.lastResult = {
      status:
        'settled',

      route:
        state.route,

      group:
        info.group.key,

      attempts:
        state.attempts,

      found:
        info.found,

      total:
        info.total,

      presentation:
        result || null,

      settledAt:
        new Date()
          .toISOString()
    };

    return state.lastResult;
  }

  function runAttempt(
    generation
  ) {

    if (
      generation !==
      state.generation
    ) {
      return;
    }

    state.timer =
      null;

    state.attempts += 1;

    var api =
      presentationApi();

    var info =
      activeGroup();

    /*
     * R2.9.2 already performs the normal presentation
     * pass when the existing coordinator calls R2_7.apply().
     *
     * If that pass already owns the mounted DOM,
     * do not call presentation again.
     */
    if (
      info &&
      info.complete
    ) {

      var beforeMarkers =
        markerState(
          info.group
        );

      if (
        beforeMarkers.ready
      ) {

        finishReady(
          info,
          {
            markers:
              beforeMarkers,

            apiLast:
              api && api.last
                ? api.last
                : null,

            extraPresentationPass:
              false
          }
        );

        return;
      }
    }

    if (!api) {

      state.lastError =
        'PRESENTATION_API_NOT_AVAILABLE';

    } else {

      try {

        api.applyPresentation();

        state.lastError =
          null;

      } catch (e) {

        state.lastError =
          e && e.message
            ? e.message
            : String(e);

      }
    }

    info =
      activeGroup();

    if (
      info &&
      info.complete
    ) {

      var markers =
        markerState(
          info.group
        );

      if (
        markers.ready
      ) {

        finishReady(
          info,
          {
            markers:
              markers,

            apiLast:
              api && api.last
                ? api.last
                : null,

            extraPresentationPass:
              true
          }
        );

        return;
      }
    }

    if (
      state.attempts >=
      MAX_ATTEMPTS
    ) {

      state.exhaustedRoute =
        state.route;

      state.lastResult = {
        status:
          'bounded-retry-exhausted',

        route:
          state.route,

        attempts:
          state.attempts,

        activeGroup:
          info
            ? info.group.key
            : null,

        found:
          info
            ? info.found
            : 0,

        total:
          info
            ? info.total
            : 0,

        lastError:
          state.lastError,

        exhaustedAt:
          new Date()
            .toISOString()
      };

      return;
    }

    var delay =
      DELAYS[
        Math.min(
          state.attempts,
          DELAYS.length - 1
        )
      ];

    state.timer =
      setTimeout(
        function () {

          runAttempt(
            generation
          );

        },
        delay
      );
  }

  function request(reason) {

    if (
      !financeRouteLikely()
    ) {
      return state.lastResult;
    }

    var key =
      routeKey();

    var info =
      activeGroup();

    state.lastReason =
      reason ||
      'unspecified';

    if (
      state.route !== key
    ) {

      cancelTimer();

      state.generation += 1;
      state.attempts = 0;
      state.route = key;
      state.settledRoute = '';
      state.exhaustedRoute = '';
    }

    if (
      state.settledRoute === key
    ) {

      if (
        info &&
        info.complete
      ) {

        var markers =
          markerState(
            info.group
          );

        if (
          markers.ready
        ) {
          return state.lastResult;
        }
      }

      state.settledRoute = '';
      state.attempts = 0;
      state.generation += 1;
    }

    if (
      state.timer != null
    ) {
      return state.lastResult;
    }

    if (
      state.exhaustedRoute === key
    ) {

      /*
       * Do not restart another retry cascade while the
       * Finance DOM is still absent.
       *
       * A later coordinator call can restart only once
       * a target Finance heading actually exists.
       */
      if (!info) {
        return state.lastResult;
      }

      state.exhaustedRoute = '';
      state.attempts = 0;
      state.generation += 1;
    }

    var generation =
      state.generation;

    runAttempt(
      generation
    );

    return state.lastResult;
  }

  function diagnose() {

    var info =
      activeGroup();

    return {
      version:
        VERSION,

      route:
        routeKey(),

      attempts:
        state.attempts,

      timerActive:
        state.timer != null,

      settledRoute:
        state.settledRoute,

      exhaustedRoute:
        state.exhaustedRoute,

      lastReason:
        state.lastReason,

      lastError:
        state.lastError,

      activeGroup:
        info
          ? {
              key:
                info.group.key,

              found:
                info.found,

              total:
                info.total,

              complete:
                info.complete,

              markers:
                markerState(
                  info.group
                )
            }
          : null,

      presentationApiAvailable:
        !!presentationApi(),

      lastResult:
        state.lastResult
    };
  }

  state.request =
    request;

  state.diagnose =
    diagnose;

  var r27 =
    window
      .__AQUILA_FINANCE_R2_7__;

  if (
    !r27 ||
    typeof r27.apply !==
      'function'
  ) {

    state.lastError =
      'R2_7_CALLABLE_NOT_AVAILABLE';

    return;
  }

  var previous =
    r27.apply;

  if (
    previous &&
    previous
      .__aquilaFinanceR293 ===
      true
  ) {

    request(
      'already-wrapped'
    );

    return;
  }

  function loadingAware() {

    var result =
      previous.apply(
        this,
        arguments
      );

    request(
      'coordinator-apply'
    );

    if (
      result &&
      typeof result.then ===
        'function'
    ) {

      result.then(
        function () {

          request(
            'coordinator-resolved'
          );

        },

        function () {

          request(
            'coordinator-rejected'
          );

        }
      );
    }

    return result;
  }

  loadingAware
    .__aquilaFinanceR293 =
    true;

  loadingAware
    .__aquilaPreviousApply =
    previous;

  r27.apply =
    loadingAware;

  if (
    financeRouteLikely()
  ) {

    request(
      'runtime-load'
    );

  }

})();
(function(){
'use strict';

var V='R2.9.4';

function n(v){
  return String(
    v == null
      ? ''
      : v
  )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function vis(e){
  if(
    !e ||
    !e.isConnected
  ){
    return false;
  }

  var s=
    getComputedStyle(e);

  var r=
    e.getBoundingClientRect();

  return (
    s.display !== 'none' &&
    s.visibility !== 'hidden' &&
    r.width > 0 &&
    r.height > 0
  );
}

function find(){

  var titles=[
    'Recent Transactions',
    'Recent Sales Transactions',
    'Recent Sales Transaction'
  ];

  var nodes=
    document.querySelectorAll(
      'h1,h2,h3,h4,h5,h6,' +
      '[role="heading"],' +
      '.card-title,' +
      '.section-title,' +
      'div,span,p'
    );

  for(
    var i=0;
    i<nodes.length;
    i++
  ){

    if(
      !vis(nodes[i]) ||
      titles.indexOf(
        n(nodes[i].textContent)
      ) < 0
    ){
      continue;
    }

    for(
      var e=nodes[i],d=0;
      e && d<10;
      d++,
      e=e.parentElement
    ){

      if(
        e.querySelector &&
        e.querySelector(
          'table'
        )
      ){
        return {
          card:e,
          table:
            e.querySelector(
              'table'
            )
        };
      }
    }
  }

  return null;
}

function css(){

  if(
    document.getElementById(
      'aquila-finance-r294-css'
    )
  ){
    return;
  }

  var s=
    document.createElement(
      'style'
    );

  s.id=
    'aquila-finance-r294-css';

  s.textContent=
    '[data-aquila-recent] table,' +
    '[data-aquila-r294-recent] table{' +
    'width:100%!important;' +
    'table-layout:auto!important;' +
    'border-collapse:collapse!important}' +

    '[data-aquila-recent] th,' +
    '[data-aquila-recent] td,' +
    '[data-aquila-r294-recent] th,' +
    '[data-aquila-r294-recent] td{' +
    'white-space:nowrap!important;' +
    'overflow:visible!important;' +
    'text-overflow:clip!important;' +
    'padding-left:6px!important;' +
    'padding-right:6px!important;' +
    'font-size:12px!important;' +
    'line-height:1.25!important}' +

    '[data-aquila-recent] th:nth-child(1),' +
    '[data-aquila-recent] td:nth-child(1),' +
    '[data-aquila-r294-recent] th:nth-child(1),' +
    '[data-aquila-r294-recent] td:nth-child(1){' +
    'width:12%!important}' +

    '[data-aquila-recent] th:nth-child(2),' +
    '[data-aquila-recent] td:nth-child(2),' +
    '[data-aquila-r294-recent] th:nth-child(2),' +
    '[data-aquila-r294-recent] td:nth-child(2){' +
    'width:9%!important}' +

    '[data-aquila-recent] th:nth-child(3),' +
    '[data-aquila-recent] td:nth-child(3),' +
    '[data-aquila-r294-recent] th:nth-child(3),' +
    '[data-aquila-r294-recent] td:nth-child(3){' +
    'width:32%!important;' +
    'max-width:none!important}' +

    '[data-aquila-recent] th:nth-child(4),' +
    '[data-aquila-recent] td:nth-child(4),' +
    '[data-aquila-r294-recent] th:nth-child(4),' +
    '[data-aquila-r294-recent] td:nth-child(4){' +
    'width:12%!important}' +

    '[data-aquila-recent] th:nth-child(5),' +
    '[data-aquila-recent] td:nth-child(5),' +
    '[data-aquila-r294-recent] th:nth-child(5),' +
    '[data-aquila-r294-recent] td:nth-child(5){' +
    'width:18%!important;' +
    'text-align:right!important}' +

    '[data-aquila-recent] th:nth-child(6),' +
    '[data-aquila-recent] td:nth-child(6),' +
    '[data-aquila-r294-recent] th:nth-child(6),' +
    '[data-aquila-r294-recent] td:nth-child(6){' +
    'width:17%!important}' +

    '[data-aquila-recent-scroll],' +
    '[data-aquila-r294-recent-scroll]{' +
    'overflow-x:auto!important;' +
    'overflow-y:auto!important}';

  document.head.appendChild(
    s
  );
}

function apply(){

  css();

  var f=find();

  if(!f){
    return {
      found:false
    };
  }

  f.card.setAttribute(
    'data-aquila-r294-recent',
    '1'
  );

  if(
    f.table.parentElement
  ){
    f.table.parentElement
      .setAttribute(
        'data-aquila-r294-recent-scroll',
        '1'
      );
  }

  f.table
    .querySelectorAll(
      'tbody tr'
    )
    .forEach(
      function(r){

        Array.prototype
          .forEach.call(
            r.children,
            function(c){

              var t=
                n(
                  c.textContent
                );

              if(t){
                c.title=t;
              }
            }
          );
      }
    );

  return {
    found:true,
    columns:
      f.table
        .querySelectorAll(
          'thead th'
        )
        .length,
    rows:
      f.table
        .querySelectorAll(
          'tbody tr'
        )
        .length
  };
}

function diag(){

  var f=find();

  if(!f){
    return {
      found:false
    };
  }

  var wrapped=0;
  var hidden=0;
  var ellipsis=0;

  f.table
    .querySelectorAll(
      'th,td'
    )
    .forEach(
      function(c){

        var s=
          getComputedStyle(c);

        if(
          s.whiteSpace !==
          'nowrap'
        ){
          wrapped++;
        }

        if(
          s.overflow === 'hidden' ||
          s.overflowX === 'hidden'
        ){
          hidden++;
        }

        if(
          s.textOverflow ===
          'ellipsis'
        ){
          ellipsis++;
        }
      }
    );

  var p=
    f.table.parentElement;

  return {
    found:true,

    columns:
      f.table
        .querySelectorAll(
          'thead th'
        )
        .length,

    rows:
      f.table
        .querySelectorAll(
          'tbody tr'
        )
        .length,

    wrappedCells:
      wrapped,

    hiddenCells:
      hidden,

    ellipsisCells:
      ellipsis,

    horizontalFallbackAvailable:
      !!p &&
      [
        'auto',
        'scroll'
      ].indexOf(
        getComputedStyle(p)
          .overflowX
      ) >= 0,

    tableScrollWidth:
      f.table.scrollWidth,

    tableClientWidth:
      f.table.clientWidth
  };
}

var P=
  window
    .__AQUILA_FINANCE_BROWSER_REMEDIATION__;

if(
  P &&
  typeof P.applyPresentation ===
    'function' &&
  !P.applyPresentation
    .__aquilaFinanceR294
){

  var prev=
    P.applyPresentation;

  var wrap=
    function(){

      var r=
        prev.apply(
          this,
          arguments
        );

      apply();

      return r;
    };

  wrap
    .__aquilaFinanceR294 =
    true;

  wrap
    .__aquilaPrevious =
    prev;

  P.applyPresentation=
    wrap;
}

apply();

window
  .__AQUILA_FINANCE_R2_9_4__ = {

  version:V,

  applyRecentLayout:
    apply,

  diagnose:
    function(){

      return {

        version:V,

        dataCoordinator:
          window
            .__AQUILA_FINANCE_DATA_COORDINATOR__
            ? window
                .__AQUILA_FINANCE_DATA_COORDINATOR__
                .diagnose()
            : null,

        loadingSettle:
          window
            .__AQUILA_FINANCE_LOADING_SETTLE__ &&
          typeof window
            .__AQUILA_FINANCE_LOADING_SETTLE__
            .diagnose ===
            'function'
            ? window
                .__AQUILA_FINANCE_LOADING_SETTLE__
                .diagnose()
            : null,

        presentation:
          window
            .__AQUILA_FINANCE_BROWSER_REMEDIATION__ &&
          typeof window
            .__AQUILA_FINANCE_BROWSER_REMEDIATION__
            .diagnose ===
            'function'
            ? window
                .__AQUILA_FINANCE_BROWSER_REMEDIATION__
                .diagnose()
            : null,

        recentTransactions:
          diag()
      };
    }
};

})();
(function(){
'use strict';

var VERSION='R2.9.5';
var CACHE_TTL=60000;
var RETRY_DELAY=180;
var MAX_BODY=5242880;
var MAX_OWNERSHIP_FRAMES=180;
var READY_STABLE_FRAMES=5;

var GROUPS={
  'overview':{
    titles:[
      'Revenue vs Expenses Trend',
      'Cash Flow Overview'
    ],
    tables:[
      'Recent Transactions',
      'Recent Sales Transactions',
      'Top Receivables'
    ]
  },
  'financial-statements':{
    titles:[
      'Income vs Expenses',
      'Net Profit Trend'
    ],
    tables:[]
  },
  'profit-loss':{
    titles:[
      'Income vs Expenses',
      'Net Profit Trend'
    ],
    tables:[]
  },
  'cash-flow':{
    titles:[
      'Cash Inflow vs Cash Outflow',
      'Net Cash Flow Trend'
    ],
    tables:[]
  },
  'cashflow':{
    titles:[
      'Cash Inflow vs Cash Outflow',
      'Net Cash Flow Trend'
    ],
    tables:[]
  },
  'sales':{
    titles:[
      'Sales vs Returns',
      'Revenue Trend'
    ],
    tables:[]
  }
};

var CHART_GRANULARITY={
  'Revenue vs Expenses Trend':'monthly',
  'Cash Flow Overview':'monthly',
  'Income vs Expenses':'daily',
  'Net Profit Trend':'daily',
  'Cash Inflow vs Cash Outflow':'daily',
  'Net Cash Flow Trend':'daily',
  'Sales vs Returns':'daily',
  'Revenue Trend':'daily'
};

function norm(v){
  return String(v==null?'':v)
    .replace(/\s+/g,' ')
    .trim();
}

function visible(el){
  if(!el || !el.isConnected) return false;
  var s=getComputedStyle(el);
  var r=el.getBoundingClientRect();
  return s.display!=='none' &&
    s.visibility!=='hidden' &&
    r.width>0 &&
    r.height>0;
}

function params(){
  try{
    return new URLSearchParams(
      String(location.hash||'').replace(/^#/,'')
    );
  }catch(_){
    return new URLSearchParams();
  }
}

function financeModule(){
  var p=params();
  var section=p.get('section');
  var m=p.get('finance');
  if(section!=='finance' && !m) return '';
  return m || 'overview';
}

function routeKey(){
  var p=params();
  p.delete('scrollY');
  return location.pathname+'?'+location.search+'#'+p.toString();
}

function isFinance(){
  return !!financeModule();
}

function exactNode(text){
  var nodes=document.querySelectorAll(
    'h1,h2,h3,h4,h5,h6,'+
    '[role="heading"],.card-title,.section-title,div,span,p'
  );

  for(var i=0;i<nodes.length;i++){
    if(
      visible(nodes[i]) &&
      norm(nodes[i].textContent)===text
    ){
      return nodes[i];
    }
  }

  return null;
}

function cardFor(title,required){
  var h=exactNode(title);

  if(!h) return null;

  for(
    var e=h,d=0;
    e && d<10;
    d++,
    e=e.parentElement
  ){
    if(!e.querySelector) continue;

    if(
      required
        ? e.querySelector(required)
        : e.querySelector('svg,canvas,table')
    ){
      return e;
    }
  }

  return h.parentElement;
}

function reactProps(el){
  for(
    var e=el,up=0;
    e && up<4;
    up++,
    e=e.parentElement
  ){
    try{
      var keys=Object.keys(e);

      for(var i=0;i<keys.length;i++){
        if(
          keys[i].indexOf('__reactProps$')===0
        ){
          return e[keys[i]]||{};
        }
      }

      for(var j=0;j<keys.length;j++){
        if(
          keys[j].indexOf('__reactFiber$')===0
        ){
          var f=e[keys[j]];

          for(
            var d=0;
            f && d<5;
            d++,
            f=f.return
          ){
            if(f.memoizedProps){
              return f.memoizedProps;
            }
          }
        }
      }
    }catch(_){}
  }

  return {};
}

function numeric(v){
  if(
    typeof v==='number' &&
    isFinite(v)
  ){
    return v;
  }

  if(
    typeof v==='string' &&
    v.trim()!=='' &&
    isFinite(Number(v))
  ){
    return Number(v);
  }

  return null;
}

function valueFromProps(p){
  if(!p) return null;

  var v=numeric(p.value);

  if(v!==null) return v;

  if(Array.isArray(p.value)){
    for(
      var i=p.value.length-1;
      i>=0;
      i--
    ){
      v=numeric(p.value[i]);

      if(v!==null) return v;
    }
  }

  if(
    Array.isArray(p.tooltipPayload) &&
    p.tooltipPayload[0]
  ){
    v=numeric(
      p.tooltipPayload[0].value
    );

    if(v!==null) return v;
  }

  if(
    p.payload &&
    p.dataKey
  ){
    v=numeric(
      p.payload[p.dataKey]
    );

    if(v!==null) return v;
  }

  if(p.payload){
    v=numeric(
      p.payload.value
    );

    if(v!==null) return v;
  }

  return null;
}

function dateFromObject(o){
  if(
    !o ||
    typeof o!=='object'
  ){
    return '';
  }

  var keys=[
    'date',
    'day',
    'period',
    'label',
    'name',
    'month',
    'transaction_date',
    'posting_date',
    'created_at'
  ];

  for(
    var i=0;
    i<keys.length;
    i++
  ){
    var s=norm(
      o[keys[i]]
    );

    if(
      /^\d{4}-\d{2}-\d{2}/.test(s) ||
      /^[A-Za-z]{3,9}\s+\d{1,2}/.test(s) ||
      /^[A-Za-z]{3,9}\s+\d{4}/.test(s)
    ){
      return s;
    }
  }

  return '';
}

function compactDate(v,gran){
  var s=norm(v);

  if(!s) return '';

  var d=new Date(s);

  if(!isNaN(d.getTime())){
    return d.toLocaleDateString(
      undefined,
      gran==='monthly'
        ? {
            month:'short',
            year:'numeric'
          }
        : {
            month:'short',
            day:'2-digit'
          }
    );
  }

  return s;
}

function fmt(v){
  var a=Math.abs(v);

  if(a>=1000000000){
    return (
      v/1000000000
    )
      .toFixed(
        a>=10000000000
          ? 0
          : 1
      )
      .replace(
        /\.0$/,
        ''
      )+'B';
  }

  if(a>=1000000){
    return (
      v/1000000
    )
      .toFixed(
        a>=10000000
          ? 0
          : 1
      )
      .replace(
        /\.0$/,
        ''
      )+'M';
  }

  if(a>=1000){
    return (
      v/1000
    )
      .toFixed(
        a>=10000
          ? 0
          : 1
      )
      .replace(
        /\.0$/,
        ''
      )+'K';
  }

  return String(
    Math.round(v*100)/100
  );
}

function ensureCss(){
  if(
    document.getElementById(
      'aquila-finance-r295-css'
    )
  ){
    return;
  }

  var s=document.createElement(
    'style'
  );

  s.id='aquila-finance-r295-css';

  s.textContent=[
    'body[data-aquila-finance-active="1"] .recharts-cartesian-grid{display:none!important;opacity:0!important}',
    'body[data-aquila-finance-active="1"] .recharts-cartesian-grid-horizontal{display:none!important;opacity:0!important}',
    'body[data-aquila-finance-active="1"] .recharts-cartesian-grid-vertical{display:none!important;opacity:0!important}',

    '.aquila-r295-chart-scroll{overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain}',

    '.aquila-r295-axis{display:grid;align-items:start;font-size:11px;line-height:1.2;padding:5px 4px 2px;box-sizing:border-box}',

    '.aquila-r295-axis span{text-align:center;white-space:nowrap;padding:0 3px}',

    '[data-aquila-r295-recent] table{width:100%!important;table-layout:auto!important;border-collapse:collapse!important}',

    '[data-aquila-r295-recent] th,[data-aquila-r295-recent] td{white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;padding-left:5px!important;padding-right:5px!important;font-size:12px!important;line-height:1.25!important}',

    '[data-aquila-r295-recent] th:nth-child(1),[data-aquila-r295-recent] td:nth-child(1){width:12%!important}',
    '[data-aquila-r295-recent] th:nth-child(2),[data-aquila-r295-recent] td:nth-child(2){width:9%!important}',
    '[data-aquila-r295-recent] th:nth-child(3),[data-aquila-r295-recent] td:nth-child(3){width:32%!important;max-width:none!important}',
    '[data-aquila-r295-recent] th:nth-child(4),[data-aquila-r295-recent] td:nth-child(4){width:12%!important}',
    '[data-aquila-r295-recent] th:nth-child(5),[data-aquila-r295-recent] td:nth-child(5){width:18%!important;text-align:right!important}',
    '[data-aquila-r295-recent] th:nth-child(6),[data-aquila-r295-recent] td:nth-child(6){width:17%!important}',

    '[data-aquila-r295-recent-scroll]{overflow-x:auto!important;overflow-y:auto!important}',

    '[data-aquila-r295-receivables] table{width:100%!important;table-layout:auto!important}',

    '[data-aquila-r295-receivables] th,[data-aquila-r295-receivables] td{white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;padding-left:6px!important;padding-right:6px!important}',

    '[data-aquila-r295-receivables-scroll]{overflow-x:auto!important;overflow-y:auto!important}',

    'html body .ubuzima-glass-workspace-dock,html body [data-ubuzima-workspace-dock]{position:fixed!important;top:10px!important;bottom:auto!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;margin:0!important;z-index:2147482000!important}',

    '@media(max-width:767px){html body .ubuzima-glass-workspace-dock,html body [data-ubuzima-workspace-dock]{top:6px!important;bottom:auto!important}}'
  ].join('\n');

  document.head.appendChild(s);
}

function setFinanceBody(active){
  if(!document.body) return;

  if(active){
    document.body.setAttribute(
      'data-aquila-finance-active',
      '1'
    );
  }else{
    document.body.removeAttribute(
      'data-aquila-finance-active'
    );
  }
}

function svgLabel(
  svg,
  x,
  y,
  val
){
  var g=document.createElementNS(
    'http://www.w3.org/2000/svg',
    'g'
  );

  g.setAttribute(
    'data-aquila-r295-label',
    '1'
  );

  g.setAttribute(
    'pointer-events',
    'none'
  );

  var t=document.createElementNS(
    'http://www.w3.org/2000/svg',
    'text'
  );

  t.setAttribute(
    'x',
    String(x)
  );

  t.setAttribute(
    'y',
    String(y)
  );

  t.setAttribute(
    'text-anchor',
    'middle'
  );

  t.setAttribute(
    'dominant-baseline',
    'middle'
  );

  t.setAttribute(
    'fill',
    '#fff'
  );

  t.setAttribute(
    'font-size',
    '10'
  );

  t.setAttribute(
    'font-weight',
    '700'
  );

  t.textContent=fmt(val);

  g.appendChild(t);
  svg.appendChild(g);

  try{
    var b=t.getBBox();

    var r=document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect'
    );

    r.setAttribute(
      'x',
      String(b.x-4)
    );

    r.setAttribute(
      'y',
      String(b.y-2)
    );

    r.setAttribute(
      'width',
      String(b.width+8)
    );

    r.setAttribute(
      'height',
      String(b.height+4)
    );

    r.setAttribute(
      'rx',
      '3'
    );

    r.setAttribute(
      'fill',
      '#000'
    );

    g.insertBefore(
      r,
      t
    );

    return true;

  }catch(_){

    g.remove();

    return false;
  }
}

function barLabels(
  card,
  svg
){
  var count=0;

  card.querySelectorAll(
    '.recharts-bar-rectangle'
  ).forEach(function(w){

    var shape=
      w.querySelector(
        'path,rect'
      ) ||
      w;

    if(!shape.getBBox){
      return;
    }

    var p=reactProps(w);

    var v=valueFromProps(p);

    if(v===null){
      v=valueFromProps(
        reactProps(shape)
      );
    }

    if(v===null){
      return;
    }

    try{
      var b=shape.getBBox();

      var x=
        b.x+
        b.width/2;

      var y=
        v<0
          ? b.y+b.height+10
          : Math.max(
              12,
              b.y-8
            );

      if(
        svgLabel(
          svg,
          x,
          y,
          v
        )
      ){
        count++;
      }

    }catch(_){}
  });

  return count;
}

function lineLabels(
  card,
  svg
){
  var count=0;
  var seen={};

  card.querySelectorAll(
    '.recharts-line'
  ).forEach(function(line){

    var candidates=[
      line,
      line.querySelector(
        '.recharts-line-curve'
      ),
      line.querySelector(
        'path'
      )
    ].filter(Boolean);

    var points=null;

    for(
      var i=0;
      i<candidates.length &&
      !points;
      i++
    ){
      var p=reactProps(
        candidates[i]
      );

      if(
        Array.isArray(
          p.points
        ) &&
        p.points.length
      ){
        points=p.points;
      }
    }

    if(points){

      points.forEach(function(pt){

        var v=valueFromProps(pt);

        if(
          v===null &&
          pt
        ){
          v=numeric(pt.value);
        }

        var x=numeric(
          pt &&
          pt.x
        );

        var y=numeric(
          pt &&
          pt.y
        );

        if(
          v===null ||
          x===null ||
          y===null
        ){
          return;
        }

        var k=
          Math.round(x)+
          '|'+
          Math.round(y)+
          '|'+
          v;

        if(seen[k]){
          return;
        }

        seen[k]=1;

        if(
          svgLabel(
            svg,
            x,
            Math.max(
              12,
              y-10
            ),
            v
          )
        ){
          count++;
        }
      });

      return;
    }

    line.querySelectorAll(
      '.recharts-line-dot,circle'
    ).forEach(function(dot){

      var p=reactProps(dot);

      var v=valueFromProps(p);

      if(v===null){
        return;
      }

      var cx=numeric(
        dot.getAttribute &&
        dot.getAttribute('cx')
      );

      var cy=numeric(
        dot.getAttribute &&
        dot.getAttribute('cy')
      );

      if(
        cx===null ||
        cy===null
      ){
        return;
      }

      var k=
        Math.round(cx)+
        '|'+
        Math.round(cy)+
        '|'+
        v;

      if(seen[k]){
        return;
      }

      seen[k]=1;

      if(
        svgLabel(
          svg,
          cx,
          Math.max(
            12,
            cy-10
          ),
          v
        )
      ){
        count++;
      }
    });
  });

  return count;
}

function addLabels(card){
  var svg=card.querySelector(
    'svg'
  );

  if(!svg){
    return 0;
  }

  svg.querySelectorAll(
    '[data-aquila-value-label="1"],' +
    '[data-aquila-r295-label="1"]'
  ).forEach(function(e){
    e.remove();
  });

  return (
    barLabels(
      card,
      svg
    ) +
    lineLabels(
      card,
      svg
    )
  );
}

function nativeDates(card){
  var out=[];

  card.querySelectorAll(
    '.recharts-xAxis text,' +
    '.recharts-xAxis ' +
    '.recharts-cartesian-axis-tick-value'
  ).forEach(function(e){

    var t=norm(
      e.textContent
    );

    if(
      t &&
      out.indexOf(t)<0
    ){
      out.push(t);
    }
  });

  return out;
}

function payloadDates(card){
  var out=[];

  function add(v,gran){
    var t=compactDate(
      v,
      gran
    );

    if(
      t &&
      out.indexOf(t)<0
    ){
      out.push(t);
    }
  }

  card.querySelectorAll(
    '.recharts-line,' +
    '.recharts-bar-rectangle,' +
    '.recharts-line-dot'
  ).forEach(function(e){

    var p=reactProps(e);

    if(
      Array.isArray(
        p.points
      )
    ){
      p.points.forEach(
        function(pt){

          add(
            dateFromObject(
              pt &&
              pt.payload
            ),
            'daily'
          );
        }
      );
    }

    add(
      dateFromObject(
        p.payload
      ),
      'daily'
    );
  });

  return out;
}

function selectedMonths(){
  var count=6;

  document.querySelectorAll(
    'button,' +
    '[role="button"],' +
    '[role="option"],' +
    'option:checked'
  ).forEach(function(e){

    if(
      e.tagName!=='OPTION' &&
      !visible(e)
    ){
      return;
    }

    var m=norm(
      e.textContent
    ).match(
      /^(\d{1,2})\s+Months?$/i
    );

    if(m){
      count=Math.max(
        1,
        Math.min(
          24,
          parseInt(
            m[1],
            10
          )
        )
      );
    }
  });

  var now=new Date();
  var out=[];

  for(
    var i=count-1;
    i>=0;
    i--
  ){
    var d=new Date(
      now.getFullYear(),
      now.getMonth()-i,
      1
    );

    out.push(
      d.toLocaleDateString(
        undefined,
        {
          month:'short',
          year:'numeric'
        }
      )
    );
  }

  return out;
}

function chartAxis(
  card,
  title
){
  var gran=
    CHART_GRANULARITY[title] ||
    'daily';

  var inner=
    card.querySelector(
      '.recharts-wrapper'
    ) ||
    card.querySelector(
      'svg'
    ) ||
    card.querySelector(
      'canvas'
    );

  if(!inner){
    return {
      labels:0,
      scroll:false,
      source:'none'
    };
  }

  var host=
    inner.parentElement &&
    card.contains(
      inner.parentElement
    )
      ? inner.parentElement
      : card;

  var oldLeft=
    host.scrollLeft ||
    0;

  host.classList.add(
    'aquila-r295-chart-scroll'
  );

  host.querySelectorAll(
    '.aquila-r295-axis,' +
    '.aquila-finance-axis'
  ).forEach(function(e){
    e.remove();
  });

  var native=
    nativeDates(card);

  var payload=
    payloadDates(card);

  var labels;
  var source;
  var needsStrip=false;

  if(gran==='monthly'){

    labels=
      native.length>=2
        ? native
        : selectedMonths();

    source=
      native.length>=2
        ? 'native'
        : 'selected-month-window';

    needsStrip=
      native.length<2;

  }else{

    labels=
      payload.length>=2
        ? payload
        : native;

    source=
      payload.length>=2
        ? 'genuine-payload'
        : 'native';

    needsStrip=
      payload.length>=2 &&
      payload.length>
      native.length;
  }

  var width=Math.max(
    Math.round(
      card
        .getBoundingClientRect()
        .width ||
      0
    ),
    labels.length*
    (
      gran==='monthly'
        ? 105
        : 76
    )
  );

  if(
    inner.style &&
    labels.length
  ){
    inner.style.minWidth=
      width+'px';
  }

  if(
    labels.length &&
    needsStrip
  ){
    var strip=
      document.createElement(
        'div'
      );

    strip.className=
      'aquila-r295-axis';

    strip.setAttribute(
      'data-axis-source',
      source
    );

    strip.setAttribute(
      'data-granularity',
      gran
    );

    strip.style
      .gridTemplateColumns=
      'repeat('+
      labels.length+
      ',minmax(68px,1fr))';

    strip.style.minWidth=
      width+'px';

    labels.forEach(
      function(v){

        var s=
          document.createElement(
            'span'
          );

        s.textContent=v;

        strip.appendChild(s);
      }
    );

    host.appendChild(strip);
  }

  host.scrollLeft=oldLeft;

  return {
    labels:
      labels.length,

    scroll:
      host.scrollWidth>
      host.clientWidth+2,

    source:
      source
  };
}

function applyChart(title){
  var card=cardFor(title);

  if(!card){
    return {
      title:title,
      found:false
    };
  }

  card.setAttribute(
    'data-aquila-chart',
    title
  );

  card.setAttribute(
    'data-aquila-granularity',
    CHART_GRANULARITY[title] ||
    'daily'
  );

  card.querySelectorAll(
    '.recharts-cartesian-grid'
  ).forEach(function(g){

    g.style.setProperty(
      'display',
      'none',
      'important'
    );

    g.style.setProperty(
      'opacity',
      '0',
      'important'
    );
  });

  var axis=chartAxis(
    card,
    title
  );

  var labels=
    addLabels(card);

  return {
    title:title,
    found:true,

    granularity:
      CHART_GRANULARITY[title] ||
      'daily',

    dataLabels:
      labels,

    xAxisLabels:
      axis.labels,

    xAxisSource:
      axis.source,

    horizontalScrollable:
      axis.scroll,

    gridVisible:
      Array.prototype
        .some.call(
          card.querySelectorAll(
            '.recharts-cartesian-grid'
          ),
          visible
        )
  };
}

function fiveRows(
  table,
  marker
){
  var p=
    table.parentElement;

  if(!p){
    return false;
  }

  var oldTop=
    p.scrollTop ||
    0;

  var rows=
    table.querySelectorAll(
      'tbody tr'
    );

  p.setAttribute(
    marker,
    '1'
  );

  if(rows.length>5){

    var head=
      table.querySelector(
        'thead'
      );

    var h=
      head
        ? head
            .getBoundingClientRect()
            .height
        : 40;

    for(
      var i=0;
      i<5;
      i++
    ){
      h+=
        rows[i]
          .getBoundingClientRect()
          .height ||
        38;
    }

    p.style.setProperty(
      'max-height',
      Math.ceil(h+2)+'px',
      'important'
    );

    p.style.setProperty(
      'overflow-y',
      'auto',
      'important'
    );

    p.style.setProperty(
      'overflow-x',
      'auto',
      'important'
    );

  }else{

    p.style.removeProperty(
      'max-height'
    );
  }

  p.scrollTop=oldTop;

  return (
    p.scrollHeight>
    p.clientHeight+2
  );
}

function recentCard(){
  var names=[
    'Recent Transactions',
    'Recent Sales Transactions',
    'Recent Sales Transaction'
  ];

  for(
    var i=0;
    i<names.length;
    i++
  ){
    var c=cardFor(
      names[i],
      'table'
    );

    if(c){
      return c;
    }
  }

  return null;
}

function applyRecent(){
  var c=recentCard();

  if(!c){
    return {
      found:false
    };
  }

  var t=
    c.querySelector(
      'table'
    );

  if(!t){
    return {
      found:false
    };
  }

  c.setAttribute(
    'data-aquila-r295-recent',
    '1'
  );

  t.querySelectorAll(
    'th,td'
  ).forEach(
    function(cell){

      cell.style.setProperty(
        'white-space',
        'nowrap',
        'important'
      );

      cell.style.setProperty(
        'overflow',
        'visible',
        'important'
      );

      cell.style.setProperty(
        'text-overflow',
        'clip',
        'important'
      );

      var tx=norm(
        cell.textContent
      );

      if(tx){
        cell.title=tx;
      }
    }
  );

  var scroll=fiveRows(
    t,
    'data-aquila-r295-recent-scroll'
  );

  var hs=
    t.querySelectorAll(
      'thead th'
    );

  return {
    found:true,

    columns:
      hs.length,

    rows:
      t.querySelectorAll(
        'tbody tr'
      ).length,

    statusVisible:
      hs.length>=6 &&
      /status/i.test(
        norm(
          hs[5].textContent
        )
      ),

    verticalScroll:
      scroll
  };
}

function ageValue(v){
  var s=norm(v);

  if(!s){
    return '—';
  }

  if(/^\d+$/.test(s)){
    return s;
  }

  var d=new Date(s);

  if(
    isNaN(
      d.getTime()
    )
  ){
    return '—';
  }

  var now=new Date();

  var a=Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  var b=Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );

  var days=Math.floor(
    (a-b)/86400000
  );

  return days>=0
    ? String(days)
    : '—';
}

function applyReceivables(){
  var c=cardFor(
    'Top Receivables',
    'table'
  );

  if(!c){
    return {
      found:false
    };
  }

  var t=c.querySelector(
    'table'
  );

  if(!t){
    return {
      found:false
    };
  }

  c.setAttribute(
    'data-aquila-r295-receivables',
    '1'
  );

  var hs=
    Array.prototype
      .slice.call(
        t.querySelectorAll(
          'thead th'
        )
      );

  var names=
    hs.map(
      function(h){
        return norm(
          h.textContent
        ).toLowerCase();
      }
    );

  function idx(re){
    for(
      var i=0;
      i<names.length;
      i++
    ){
      if(
        re.test(
          names[i]
        )
      ){
        return i;
      }
    }

    return -1;
  }

  var insurer=
    idx(
      /insurer|insurance|partner/
    );

  var customer=
    idx(
      /customer|patient|member|payer|client/
    );

  var outstanding=
    idx(
      /outstanding|balance|amount|receivable/
    );

  var ageing=
    idx(
      /ageing|aging|days|issue.?date|transaction.?date|posting.?date|due.?date|date/
    );

  var safe=
    customer>=0 &&
    outstanding>=0 &&
    hs.length>=4;

  if(safe){

    t.querySelectorAll(
      'tbody tr'
    ).forEach(function(r){

      var cells=
        Array.prototype
          .slice.call(
            r.children
          );

      if(
        cells.length<
        hs.length
      ){
        return;
      }

      var vals=[
        insurer>=0
          ? (
              norm(
                cells[insurer]
                  .textContent
              ) ||
              '—'
            )
          : '—',

        norm(
          cells[customer]
            .textContent
        ) ||
        '—',

        norm(
          cells[outstanding]
            .textContent
        ) ||
        '—',

        ageing>=0
          ? ageValue(
              cells[ageing]
                .textContent
            )
          : '—'
      ];

      for(
        var j=0;
        j<4;
        j++
      ){

        cells[j].textContent=
          vals[j];

        cells[j].title=
          vals[j];

        cells[j].style.display=
          '';

        cells[j].style
          .setProperty(
            'white-space',
            'nowrap',
            'important'
          );

        cells[j].style
          .setProperty(
            'overflow',
            'visible',
            'important'
          );

        cells[j].style
          .setProperty(
            'text-overflow',
            'clip',
            'important'
          );
      }

      for(
        var k=4;
        k<cells.length;
        k++
      ){
        cells[k].style.display=
          'none';
      }
    });

    [
      'Insurer',
      'Customer',
      'Outstanding',
      'Ageing (Days)'
    ].forEach(
      function(v,i){

        hs[i].textContent=v;

        hs[i].style.display=
          '';
      }
    );

    for(
      var h=4;
      h<hs.length;
      h++
    ){
      hs[h].style.display=
        'none';
    }
  }

  var scroll=fiveRows(
    t,
    'data-aquila-r295-receivables-scroll'
  );

  return {
    found:true,

    mappingSafe:
      safe,

    sourceColumns:
      names,

    projectedFourColumns:
      safe,

    rows:
      t.querySelectorAll(
        'tbody tr'
      ).length,

    verticalScroll:
      scroll
  };
}

function forceDeck(){
  var docks=
    document.querySelectorAll(
      '.ubuzima-glass-workspace-dock,' +
      '[data-ubuzima-workspace-dock]'
    );

  docks.forEach(
    function(e){

      e.style.setProperty(
        'position',
        'fixed',
        'important'
      );

      e.style.setProperty(
        'top',
        innerWidth<=767
          ? '6px'
          : '10px',
        'important'
      );

      e.style.setProperty(
        'bottom',
        'auto',
        'important'
      );

      e.style.setProperty(
        'left',
        '50%',
        'important'
      );

      e.style.setProperty(
        'right',
        'auto',
        'important'
      );

      e.style.setProperty(
        'transform',
        'translateX(-50%)',
        'important'
      );

      e.style.setProperty(
        'margin',
        '0',
        'important'
      );

      e.style.setProperty(
        'z-index',
        '2147482000',
        'important'
      );
    }
  );

  return docks.length;
}

function salesReturnsAudit(){
  var c=cardFor(
    'Sales vs Returns'
  );

  if(!c){
    return {
      found:false
    };
  }

  var returnFields={};
  var paidFields={};
  var positiveReturnEvidence=0;

  function inspectObject(o){
    if(
      !o ||
      typeof o!=='object'
    ){
      return;
    }

    Object.keys(o)
      .forEach(
        function(k){

          var low=
            k.toLowerCase();

          var v=
            numeric(
              o[k]
            );

          if(
            /refund|return/
              .test(low)
          ){
            returnFields[k]=true;

            if(
              v!==null &&
              v>0
            ){
              positiveReturnEvidence++;
            }
          }

          if(
            /paid|payment/
              .test(low)
          ){
            paidFields[k]=true;
          }
        }
      );
  }

  c.querySelectorAll(
    '.recharts-line,' +
    '.recharts-bar-rectangle,' +
    '.recharts-line-dot'
  ).forEach(
    function(e){

      var p=reactProps(e);

      inspectObject(
        p.payload
      );

      if(
        Array.isArray(
          p.points
        )
      ){
        p.points.forEach(
          function(pt){

            inspectObject(
              pt &&
              pt.payload
            );
          }
        );
      }
    }
  );

  return {
    found:true,

    genuineReturnFields:
      Object.keys(
        returnFields
      ),

    paidFields:
      Object.keys(
        paidFields
      ),

    positiveReturnEvidence:
      positiveReturnEvidence,

    refundOnlySourceProven:
      Object.keys(
        returnFields
      ).length>0
  };
}

function present(){
  ensureCss();

  if(isFinance()){
    setFinanceBody(true);
  }else{
    setFinanceBody(false);

    return {
      finance:false
    };
  }

  var y=scrollY;

  var titles=
    Object.keys(
      CHART_GRANULARITY
    );

  var charts=
    titles.map(
      applyChart
    );

  var recent=
    applyRecent();

  var rec=
    applyReceivables();

  var deck=
    forceDeck();

  if(scrollY!==y){
    scrollTo(
      scrollX,
      y
    );
  }

  state.lastPresentation={
    at:
      new Date()
        .toISOString(),

    module:
      financeModule(),

    charts:
      charts,

    recentTransactions:
      recent,

    topReceivables:
      rec,

    deckCount:
      deck,

    salesReturns:
      salesReturnsAudit()
  };

  return state.lastPresentation;
}

/* ========================================================
   R2.9.5 SHARED CROSS-MODULE FINANCE CACHE
   ======================================================== */

var existingFetch=
  window.fetch;

var nativeFetch=
  existingFetch &&
  existingFetch
    .__aquilaNativeFetch
    ? existingFetch
        .__aquilaNativeFetch
    : (
        existingFetch
          ? existingFetch
              .bind(window)
          : null
      );

var cache=
  new Map();

var inflight=
  new Map();

var moduleStats={};

var cacheStats={
  requestsSeen:0,
  financeRequests:0,
  networkRequests:0,
  cacheHits:0,
  cacheWrites:0,
  deduplicated:0,
  retries:0,
  staleFallbacks:0,
  invalidations:0,
  errors:0,
  lastUrl:'',
  lastModule:'',
  lastStatus:null,
  lastError:null,
  lastSuccessAt:null
};

function stat(m){
  m=m || 'unknown';

  return (
    moduleStats[m] ||
    (
      moduleStats[m]={
        seen:0,
        network:0,
        cacheHits:0,
        deduplicated:0,
        retries:0,
        staleFallbacks:0,
        successes:0,
        errors:0,
        lastUrl:'',
        lastStatus:null,
        lastError:null,
        lastSuccessAt:null
      }
    )
  );
}

function urlOf(input){
  try{
    return new URL(
      typeof input==='string'
        ? input
        : (
            input &&
            input.url
          ) ||
          '',
      location.href
    );
  }catch(_){
    return null;
  }
}

function methodOf(
  input,
  init
){
  return String(
    (
      init &&
      init.method
    ) ||
    (
      input &&
      input.method
    ) ||
    'GET'
  ).toUpperCase();
}

function financeApi(u){
  if(!u){
    return false;
  }

  var same=
    u.origin===
      location.origin ||
    /\.ubuzimaplus\.com$/i
      .test(
        u.hostname
      );

  var path=
    String(
      u.pathname ||
      ''
    );

  if(
    !same ||
    /\.(js|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|map|pdf)$/i
      .test(path) ||
    /\/(login|logout|auth|csrf|token|session|password|permissions?|roles?|users?\/me|me)(\/|$)/i
      .test(path)
  ){
    return false;
  }

  return (
    /finance|financial|ledger|journal|receivable|payable|cash[-_ ]?flow|sales|accounting|statement|transaction/i
      .test(
        u.href
      )
  );
}

function forceNetwork(
  input,
  init
){
  var c=String(
    (
      init &&
      init.cache
    ) ||
    (
      input &&
      input.cache
    ) ||
    ''
  ).toLowerCase();

  return (
    c==='reload' ||
    c==='no-cache' ||
    c==='no-store'
  );
}

function cacheKey(
  input,
  init,
  u
){
  var accept='';

  try{
    accept=
      new Headers(
        (
          init &&
          init.headers
        ) ||
        (
          input &&
          input.headers
        ) ||
        undefined
      )
        .get(
          'accept'
        ) ||
      '';
  }catch(_){}

  /*
   * Module is intentionally NOT part of this key.
   * Identical Finance endpoints + filters are shared.
   */
  return [
    u.href,
    accept
  ].join('|');
}

function snapshotResponse(r){
  return r
    .arrayBuffer()
    .then(
      function(body){

        var headers=[];

        r.headers
          .forEach(
            function(v,k){
              headers.push(
                [k,v]
              );
            }
          );

        return {
          body:
            body,

          headers:
            headers,

          status:
            r.status,

          statusText:
            r.statusText,

          url:
            r.url ||
            '',

          ok:
            r.ok,

          noStore:
            /\bno-store\b/i
              .test(
                r.headers
                  .get(
                    'cache-control'
                  ) ||
                ''
              ),

          small:
            body.byteLength<=
            MAX_BODY,

          at:
            Date.now()
        };
      }
    );
}

function responseFrom(
  s,
  source
){
  var body=
    (
      s.status===204 ||
      s.status===205 ||
      s.status===304
    )
      ? null
      : s.body.slice(0);

  var r=
    new Response(
      body,
      {
        status:
          s.status,

        statusText:
          s.statusText,

        headers:
          s.headers
      }
    );

  try{
    Object.defineProperty(
      r,
      'url',
      {
        configurable:true,
        value:s.url
      }
    );

    Object.defineProperty(
      r,
      '__aquilaFinanceCache',
      {
        configurable:true,
        value:source
      }
    );
  }catch(_){}

  return r;
}

function sleep(ms){
  return new Promise(
    function(resolve){
      setTimeout(
        resolve,
        ms
      );
    }
  );
}

function network(
  input,
  init,
  attempt,
  m
){
  cacheStats
    .networkRequests++;

  stat(m)
    .network++;

  return nativeFetch(
    input,
    init
  )
    .then(
      snapshotResponse
    )
    .then(
      function(s){

        cacheStats
          .lastStatus=
          s.status;

        if(
          s.status>=500 &&
          attempt===0
        ){
          cacheStats.retries++;
          stat(m).retries++;

          return sleep(
            RETRY_DELAY
          )
            .then(
              function(){
                return network(
                  input,
                  init,
                  1,
                  m
                );
              }
            );
        }

        return s;
      }
    )
    .catch(
      function(e){

        if(attempt===0){
          cacheStats.retries++;
          stat(m).retries++;

          return sleep(
            RETRY_DELAY
          )
            .then(
              function(){
                return network(
                  input,
                  init,
                  1,
                  m
                );
              }
            );
        }

        throw e;
      }
    );
}

function invalidate(reason){
  cache.clear();

  cacheStats
    .invalidations++;

  cacheStats
    .lastInvalidationReason=
    reason ||
    'manual';
}

function sharedGet(
  input,
  init,
  u
){
  var m=
    financeModule() ||
    'unknown';

  var b=stat(m);

  var k=cacheKey(
    input,
    init,
    u
  );

  var old=
    cache.get(k);

  if(
    old &&
    !forceNetwork(
      input,
      init
    ) &&
    Date.now()-old.at<
      CACHE_TTL
  ){
    cacheStats.cacheHits++;
    b.cacheHits++;
    b.successes++;

    b.lastStatus=
      old.s.status;

    b.lastSuccessAt=
      new Date()
        .toISOString();

    return Promise.resolve(
      responseFrom(
        old.s,
        'memory-hit'
      )
    );
  }

  if(
    inflight.has(k)
  ){
    cacheStats
      .deduplicated++;

    b.deduplicated++;

    return inflight
      .get(k)
      .then(
        function(s){
          return responseFrom(
            s,
            'deduplicated'
          );
        }
      );
  }

  var p=
    network(
      input,
      init,
      0,
      m
    )
      .then(
        function(s){

          if(
            s.ok &&
            s.small &&
            !s.noStore
          ){
            cache.set(
              k,
              {
                at:Date.now(),
                s:s
              }
            );

            cacheStats
              .cacheWrites++;
          }

          if(s.ok){
            var now=
              new Date()
                .toISOString();

            cacheStats
              .lastSuccessAt=
              now;

            cacheStats
              .lastError=
              null;

            b.successes++;

            b.lastStatus=
              s.status;

            b.lastSuccessAt=
              now;

            b.lastError=
              null;
          }

          return s;
        }
      )
      .catch(
        function(e){

          var msg=
            e &&
            e.message
              ? e.message
              : String(e);

          if(old){
            cacheStats
              .staleFallbacks++;

            b.staleFallbacks++;

            cacheStats
              .lastError=
              msg;

            b.lastError=
              msg;

            return old.s;
          }

          cacheStats.errors++;
          b.errors++;

          cacheStats
            .lastError=
            msg;

          b.lastError=
            msg;

          throw e;
        }
      )
      .finally(
        function(){
          inflight.delete(k);
        }
      );

  inflight.set(
    k,
    p
  );

  return p.then(
    function(s){
      return responseFrom(
        s,
        old
          ? 'network-or-stale'
          : 'network'
      );
    }
  );
}

function financeFetch(
  input,
  init
){
  cacheStats
    .requestsSeen++;

  if(!nativeFetch){
    return Promise.reject(
      new Error(
        'FETCH_NOT_AVAILABLE'
      )
    );
  }

  var u=urlOf(input);

  var method=
    methodOf(
      input,
      init
    );

  var module=
    financeModule();

  if(
    !module ||
    !financeApi(u)
  ){
    return nativeFetch(
      input,
      init
    );
  }

  cacheStats
    .financeRequests++;

  var b=stat(module);

  b.seen++;

  b.lastUrl=
    u
      ? u.href
      : '';

  cacheStats.lastUrl=
    u
      ? u.href
      : '';

  cacheStats.lastModule=
    module;

  if(method==='GET'){
    return sharedGet(
      input,
      init,
      u
    );
  }

  return nativeFetch(
    input,
    init
  )
    .then(
      function(r){

        if(
          r &&
          r.ok
        ){
          invalidate(
            'finance-mutation:'+
            method
          );
        }

        return r;
      }
    );
}

if(nativeFetch){
  financeFetch
    .__aquilaFinanceR295=
    true;

  financeFetch
    .__aquilaNativeFetch=
    nativeFetch;

  window.fetch=
    financeFetch;
}

var cacheApi={
  version:
    VERSION,

  ttlMs:
    CACHE_TTL,

  memoryOnly:
    true,

  modulePartitioned:
    false,

  persistentStorage:
    false,

  invalidate:
    invalidate,

  diagnose:
    function(){

      var entries=[];

      cache.forEach(
        function(v,k){

          entries.push({
            key:k,
            ageMs:
              Date.now()-v.at,
            status:
              v.s.status
          });
        }
      );

      return {
        version:
          VERSION,

        module:
          financeModule(),

        financeRoute:
          isFinance(),

        ttlMs:
          CACHE_TTL,

        memoryOnly:
          true,

        persistentStorage:
          false,

        modulePartitioned:
          false,

        cacheEntries:
          entries,

        inflightCount:
          inflight.size,

        stats:
          Object.assign(
            {},
            cacheStats
          ),

        modules:
          JSON.parse(
            JSON.stringify(
              moduleStats
            )
          )
      };
    }
};

window
  .__AQUILA_FINANCE_DATA_COORDINATOR__=
  cacheApi;

/* ========================================================
   SPA NAVIGATION / MODULE OWNERSHIP
   ======================================================== */

var state=
  window
    .__AQUILA_FINANCE_R2_9_5_STATE__ ||
  {
    route:'',
    module:'',
    generation:0,
    frame:0,
    stableFrames:0,
    raf:0,
    refreshFallbackUsed:false,
    routeEvents:0,
    lastPresentation:null,
    lastRouteAt:null,
    scroll:{},
    lastRefreshButton:null
  };

window
  .__AQUILA_FINANCE_R2_9_5_STATE__=
  state;

function saveScroll(){
  var m=
    state.module ||
    financeModule();

  if(!m){
    return;
  }

  var record={
    pageX:
      scrollX,

    pageY:
      scrollY,

    chart:[],

    tables:[]
  };

  document.querySelectorAll(
    '.aquila-r295-chart-scroll,' +
    '.aquila-finance-chart-scroll'
  ).forEach(
    function(e,i){

      record.chart.push({
        i:i,
        left:e.scrollLeft,
        top:e.scrollTop
      });
    }
  );

  document.querySelectorAll(
    '[data-aquila-r295-recent-scroll],' +
    '[data-aquila-r295-receivables-scroll],' +
    '[data-aquila-recent-scroll],' +
    '[data-aquila-receivables-scroll]'
  ).forEach(
    function(e,i){

      record.tables.push({
        i:i,
        left:e.scrollLeft,
        top:e.scrollTop
      });
    }
  );

  state.scroll[m]=record;
}

function restoreScroll(m){
  var record=
    state.scroll[m];

  if(!record){
    return;
  }

  scrollTo(
    record.pageX || 0,
    record.pageY || 0
  );

  var charts=
    document.querySelectorAll(
      '.aquila-r295-chart-scroll,' +
      '.aquila-finance-chart-scroll'
    );

  record.chart
    .forEach(
      function(v){

        if(charts[v.i]){
          charts[v.i].scrollLeft=
            v.left || 0;

          charts[v.i].scrollTop=
            v.top || 0;
        }
      }
    );

  var tables=
    document.querySelectorAll(
      '[data-aquila-r295-recent-scroll],' +
      '[data-aquila-r295-receivables-scroll],' +
      '[data-aquila-recent-scroll],' +
      '[data-aquila-receivables-scroll]'
    );

  record.tables
    .forEach(
      function(v){

        if(tables[v.i]){
          tables[v.i].scrollLeft=
            v.left || 0;

          tables[v.i].scrollTop=
            v.top || 0;
        }
      }
    );
}

function expectedGroup(){
  return (
    GROUPS[
      financeModule()
    ] ||
    null
  );
}

function targetReadiness(){
  var g=
    expectedGroup();

  if(!g){
    return {
      known:false,
      found:0,
      total:0,
      complete:false
    };
  }

  var found=0;

  g.titles
    .forEach(
      function(t){

        var c=
          cardFor(t);

        if(
          c &&
          c.querySelector(
            '.recharts-bar-rectangle,' +
            '.recharts-line-curve,' +
            '.recharts-line-dot,' +
            '.recharts-area-curve,' +
            '.recharts-scatter-symbol'
          )
        ){
          found++;
        }
      }
    );

  var total=
    g.titles.length;

  return {
    known:true,
    found:found,
    total:total,
    complete:
      found===total
  };
}

function refreshButton(){
  var buttons=
    document.querySelectorAll(
      'button,' +
      '[role="button"]'
    );

  for(
    var i=0;
    i<buttons.length;
    i++
  ){
    var b=buttons[i];

    if(
      !visible(b) ||
      b.disabled
    ){
      continue;
    }

    var txt=norm(
      b.textContent ||
      b.getAttribute(
        'aria-label'
      ) ||
      b.getAttribute(
        'title'
      )
    );

    if(
      /^(Refresh|Refresh Data|Reload Data|Retry)$/i
        .test(txt)
    ){
      var rp=
        reactProps(b);

      if(
        typeof rp.onClick!==
        'function'
      ){
        continue;
      }

      var source='';

      try{
        source=String(
          rp.onClick
        );
      }catch(_){}

      if(
        /location\s*\.|reload\s*\(|window\.open/i
          .test(source)
      ){
        continue;
      }

      return b;
    }
  }

  return null;
}

function callExistingCoordinator(
  reason
){
  try{
    var l=
      window
        .__AQUILA_FINANCE_LOADING_SETTLE__;

    if(
      l &&
      typeof l.request===
      'function'
    ){
      l.request(
        'r2.9.5-'+reason
      );
    }
  }catch(_){}

  try{
    var r=
      window
        .__AQUILA_FINANCE_R2_7__;

    if(
      r &&
      typeof r.apply===
      'function'
    ){
      r.apply();
    }
  }catch(_){}
}

function ownershipFrame(gen){
  if(
    gen!==
    state.generation
  ){
    return;
  }

  state.frame++;

  forceDeck();

  present();

  var ready=
    targetReadiness();

  if(ready.complete){
    state.stableFrames++;
  }else{
    state.stableFrames=0;
  }

  if(
    !ready.complete &&
    !state.refreshFallbackUsed &&
    state.frame>=6
  ){
    var b=
      refreshButton();

    if(b){
      state.refreshFallbackUsed=
        true;

      state.lastRefreshButton=
        norm(
          b.textContent ||
          b.getAttribute(
            'aria-label'
          ) ||
          b.getAttribute(
            'title'
          )
        );

      try{
        b.click();
      }catch(_){}
    }
  }

  if(
    state.stableFrames>=
    READY_STABLE_FRAMES
  ){
    restoreScroll(
      financeModule()
    );

    state.raf=0;

    return;
  }

  if(
    state.frame>=
    MAX_OWNERSHIP_FRAMES
  ){
    restoreScroll(
      financeModule()
    );

    state.raf=0;

    return;
  }

  state.raf=
    requestAnimationFrame(
      function(){
        ownershipFrame(gen);
      }
    );
}

function startRoute(reason){
  var key=
    routeKey();

  var module=
    financeModule();

  if(!module){
    setFinanceBody(false);
    return;
  }

  if(
    state.route===key &&
    state.raf
  ){
    return;
  }

  if(
    state.module &&
    state.module!==module
  ){
    saveScroll();
  }

  if(state.raf){
    cancelAnimationFrame(
      state.raf
    );

    state.raf=0;
  }

  state.route=
    key;

  state.module=
    module;

  state.generation++;

  state.frame=0;

  state.stableFrames=0;

  state.refreshFallbackUsed=
    false;

  state.routeEvents++;

  state.lastRouteAt=
    new Date()
      .toISOString();

  setFinanceBody(true);

  callExistingCoordinator(
    reason ||
    'route'
  );

  var gen=
    state.generation;

  state.raf=
    requestAnimationFrame(
      function(){
        ownershipFrame(gen);
      }
    );
}

function routeEvent(reason){
  var newKey=
    routeKey();

  if(
    newKey===state.route &&
    financeModule()===
      state.module
  ){
    return;
  }

  startRoute(reason);
}

var nativePush=
  history.pushState;

var nativeReplace=
  history.replaceState;

/*
 * AQUILA_FINANCE_NAV_R3_R295_PUSH_OWNER_REMOVED
 *
 * R2.9.5 pushState browser ownership intentionally disabled.
 * R2.9.5 functions and state remain available for compatibility.
 * R2.9.6 is the canonical Finance pushState owner.
 */

/*
 * AQUILA_FINANCE_NAV_R3_R295_REPLACE_OWNER_REMOVED
 *
 * R2.9.5 replaceState browser ownership intentionally disabled.
 * R2.9.5 functions and state remain available for compatibility.
 * R2.9.6 is the canonical Finance replaceState owner.
 */

/*
 * AQUILA_FINANCE_NAV_R3_R295_HASHCHANGE_OWNER_REMOVED
 *
 * R2.9.5 hashchange browser ownership intentionally disabled.
 * R2.9.6 remains the canonical Finance hashchange owner.
 */

/*
 * AQUILA_FINANCE_NAV_R3_R295_POPSTATE_OWNER_REMOVED
 *
 * R2.9.5 popstate browser ownership intentionally disabled.
 * R2.9.6 remains the canonical Finance popstate owner.
 */

document.addEventListener(
  'click',
  function(e){

    if(!isFinance()){
      return;
    }

    var a=
      e.target &&
      e.target.closest
        ? e.target.closest(
            'a,button,[role="button"]'
          )
        : null;

    if(!a){
      return;
    }

    var text=norm(
      a.textContent ||
      a.getAttribute(
        'aria-label'
      ) ||
      a.getAttribute(
        'title'
      )
    );

    var href=
      a.getAttribute &&
      a.getAttribute(
        'href'
      );

    if(
      /overview|profit|loss|cash|sales|receivable|payable|accounting|financial/i
        .test(text) ||
      (
        href &&
        /finance=/i
          .test(href)
      )
    ){
      saveScroll();
    }
  },
  true
);

var presentation=
  window
    .__AQUILA_FINANCE_BROWSER_REMEDIATION__;

if(
  presentation &&
  typeof presentation
    .applyPresentation===
    'function' &&
  !presentation
    .applyPresentation
    .__aquilaFinanceR295
){
  var previousPresentation=
    presentation
      .applyPresentation;

  var wrappedPresentation=
    function(){

      var out=
        previousPresentation
          .apply(
            this,
            arguments
          );

      present();

      return out;
    };

  wrappedPresentation
    .__aquilaFinanceR295=
    true;

  wrappedPresentation
    .__aquilaPrevious=
    previousPresentation;

  presentation
    .applyPresentation=
    wrappedPresentation;
}

function recentDiagnostics(){
  var c=recentCard();

  if(!c){
    return {
      found:false
    };
  }

  var t=
    c.querySelector(
      'table'
    );

  if(!t){
    return {
      found:false
    };
  }

  var wrapped=0;
  var hidden=0;
  var ellipsis=0;

  t.querySelectorAll(
    'th,td'
  ).forEach(
    function(cell){

      var s=
        getComputedStyle(
          cell
        );

      if(
        s.whiteSpace!==
        'nowrap'
      ){
        wrapped++;
      }

      if(
        s.overflow===
          'hidden' ||
        s.overflowX===
          'hidden'
      ){
        hidden++;
      }

      if(
        s.textOverflow===
        'ellipsis'
      ){
        ellipsis++;
      }
    }
  );

  var p=
    t.parentElement;

  return {
    found:true,

    columns:
      t.querySelectorAll(
        'thead th'
      ).length,

    rows:
      t.querySelectorAll(
        'tbody tr'
      ).length,

    wrappedCells:
      wrapped,

    hiddenCells:
      hidden,

    ellipsisCells:
      ellipsis,

    verticalScrollable:
      !!p &&
      p.scrollHeight>
      p.clientHeight+2,

    horizontalScrollable:
      !!p &&
      p.scrollWidth>
      p.clientWidth+2
  };
}

function deckDiagnostics(){
  var out=[];

  document.querySelectorAll(
    '.ubuzima-glass-workspace-dock,' +
    '[data-ubuzima-workspace-dock]'
  ).forEach(
    function(e){

      var s=
        getComputedStyle(e);

      out.push({
        top:
          s.top,

        bottom:
          s.bottom,

        left:
          s.left,

        position:
          s.position,

        transform:
          s.transform
      });
    }
  );

  return out;
}

window
  .__AQUILA_FINANCE_R2_9_5__={
  version:
    VERSION,

  start:
    function(){
      startRoute(
        'manual'
      );
    },

  present:
    present,

  invalidateFinanceCache:
    invalidate,

  diagnose:
    function(){

      return {
        version:
          VERSION,

        route:
          routeKey(),

        module:
          financeModule(),

        routeLifecycle:{
          generation:
            state.generation,

          frames:
            state.frame,

          stableFrames:
            state.stableFrames,

          rafActive:
            !!state.raf,

          refreshFallbackUsed:
            state.refreshFallbackUsed,

          refreshButton:
            state.lastRefreshButton,

          routeEvents:
            state.routeEvents,

          lastRouteAt:
            state.lastRouteAt
        },

        dataCoordinator:
          cacheApi
            .diagnose(),

        readiness:
          targetReadiness(),

        presentation:
          state.lastPresentation,

        recentTransactions:
          recentDiagnostics(),

        topReceivables:
          applyReceivables(),

        deck:
          deckDiagnostics(),

        salesReturns:
          salesReturnsAudit(),

        loadingSettle:
          window
            .__AQUILA_FINANCE_LOADING_SETTLE__ &&
          typeof window
            .__AQUILA_FINANCE_LOADING_SETTLE__
            .diagnose===
            'function'
              ? window
                  .__AQUILA_FINANCE_LOADING_SETTLE__
                  .diagnose()
              : null
      };
    }
};

ensureCss();

if(
  document.readyState===
  'loading'
){
  document.addEventListener(
    'DOMContentLoaded',
    function(){
      startRoute(
        'runtime-load'
      );
    },
    {
      once:true
    }
  );
}else{
  startRoute(
    'runtime-load'
  );
}

})();
(function(){
'use strict';

var VERSION='R2.9.6';

var PREWARM_ENDPOINTS=
[];

var ROUTE_SETTLE_DELAY=550;
var SETTLE_FRAMES=6;

var MODULE_HINTS={
  'overview':[
    'Finance Overview',
    'Revenue vs Expenses Trend',
    'Cash Flow Overview',
    'Recent Transactions'
  ],

  'financial-statements':[
    'Profit & Loss',
    'Profit and Loss',
    'Income vs Expenses',
    'Net Profit Trend'
  ],

  'profit-loss':[
    'Profit & Loss',
    'Profit and Loss',
    'Income vs Expenses',
    'Net Profit Trend'
  ],

  'cash-flow':[
    'Cash Flow',
    'Cash Inflow vs Cash Outflow',
    'Net Cash Flow Trend'
  ],

  'cashflow':[
    'Cash Flow',
    'Cash Inflow vs Cash Outflow',
    'Net Cash Flow Trend'
  ],

  'sales':[
    'Sales',
    'Sales vs Returns',
    'Revenue Trend'
  ]
};

function norm(v){
  return String(
    v==null
      ? ''
      : v
  )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function visible(el){
  if(
    !el ||
    !el.isConnected
  ){
    return false;
  }

  var s=
    getComputedStyle(el);

  var r=
    el.getBoundingClientRect();

  return (
    s.display!=='none' &&
    s.visibility!=='hidden' &&
    r.width>0 &&
    r.height>0
  );
}

function params(){
  try{
    return new URLSearchParams(
      String(
        location.hash ||
        ''
      ).replace(
        /^#/,
        ''
      )
    );
  }catch(_){
    return new URLSearchParams();
  }
}

function moduleName(){
  var p=params();

  if(
    p.get('section')!=='finance'
  ){
    return '';
  }

  return (
    p.get('finance') ||
    'overview'
  );
}

function routeKey(){
  var p=params();

  p.delete(
    'scrollY'
  );

  return (
    location.pathname+
    location.search+
    '#'+
    p.toString()
  );
}

function financeUrl(u){
  if(!u){
    return false;
  }

  try{
    var x=
      new URL(
        u,
        location.href
      );

    if(
      x.origin!==
      location.origin
    ){
      return false;
    }

    return (
      /finance|financial|cash[-_ ]?flow|sales|receiv|payable|ledger|journal|statement|accounting|transaction/i
        .test(
          x.href
        )
    );

  }catch(_){
    return false;
  }
}

/* =======================================================
   WORKSPACE CACHE
   URL-KEYED ABOVE R2.9.5'S EXISTING CACHE
   ======================================================= */

var innerFetch=
  typeof window.fetch===
  'function'
    ? window.fetch.bind(
        window
      )
    : null;

var workspaceCache=
  new Map();

var workspaceInflight=
  new Map();

var workspaceStats={
  requests:0,
  hits:0,
  writes:0,
  deduplicated:0,
  prewarmRequests:0,
  prewarmSuccesses:0,
  prewarmErrors:0,
  mutations:0,
  invalidations:0
};

function methodOf(
  input,
  init
){
  return String(
    (
      init &&
      init.method
    ) ||
    (
      input &&
      input.method
    ) ||
    'GET'
  ).toUpperCase();
}

function urlOf(input){
  try{
    return new URL(
      typeof input===
      'string'
        ? input
        : input.url,
      location.href
    );
  }catch(_){
    return null;
  }
}

function snapshot(r){
  return r.clone()
    .arrayBuffer()
    .then(
      function(body){

        var headers=[];

        r.headers.forEach(
          function(v,k){
            headers.push(
              [k,v]
            );
          }
        );

        return {
          body:
            body,

          status:
            r.status,

          statusText:
            r.statusText,

          headers:
            headers,

          url:
            r.url,

          at:
            Date.now()
        };
      }
    );
}

function revive(s){
  var body=
    (
      s.status===204 ||
      s.status===205 ||
      s.status===304
    )
      ? null
      : s.body.slice(0);

  var r=
    new Response(
      body,
      {
        status:
          s.status,

        statusText:
          s.statusText,

        headers:
          s.headers
      }
    );

  try{
    Object.defineProperty(
      r,
      'url',
      {
        configurable:true,
        value:s.url
      }
    );

    Object.defineProperty(
      r,
      '__aquilaWorkspaceCache',
      {
        configurable:true,
        value:true
      }
    );
  }catch(_){}

  return r;
}

function invalidateWorkspace(
  reason
){
  workspaceCache.clear();

  workspaceStats
    .invalidations++;

  workspaceStats
    .lastInvalidation=
    reason ||
    'manual';

  try{
    var old=
      window
        .__AQUILA_FINANCE_DATA_COORDINATOR__;

    if(
      old &&
      typeof old.invalidate===
      'function'
    ){
      old.invalidate(
        'r2.9.6-'+
        (
          reason ||
          'manual'
        )
      );
    }
  }catch(_){}
}

function workspaceFetch(
  input,
  init
){
  if(!innerFetch){
    return Promise.reject(
      new Error(
        'FETCH_NOT_AVAILABLE'
      )
    );
  }

  var u=
    urlOf(input);

  var method=
    methodOf(
      input,
      init
    );

  if(
    !moduleName() ||
    !u ||
    !financeUrl(
      u.href
    )
  ){
    return innerFetch(
      input,
      init
    );
  }

  workspaceStats
    .requests++;

  if(method!=='GET'){
    return innerFetch(
      input,
      init
    ).then(
      function(r){

        if(
          r &&
          r.ok
        ){
          workspaceStats
            .mutations++;

          invalidateWorkspace(
            'finance-mutation:'+
            method
          );
        }

        return r;
      }
    );
  }

  var key=
    u.href;

  var hit=
    workspaceCache
      .get(key);

  if(
    hit &&
    Date.now()-hit.at<
      60000
  ){
    workspaceStats
      .hits++;

    return Promise.resolve(
      revive(
        hit
      )
    );
  }

  if(
    workspaceInflight
      .has(key)
  ){
    workspaceStats
      .deduplicated++;

    return workspaceInflight
      .get(key)
      .then(
        revive
      );
  }

  var p=
    innerFetch(
      input,
      init
    )
      .then(
        function(r){

          if(
            !r ||
            !r.ok
          ){
            return {
              response:r,
              snapshot:null
            };
          }

          return snapshot(r)
            .then(
              function(s){
                return {
                  response:r,
                  snapshot:s
                };
              }
            );
        }
      )
      .then(
        function(out){

          if(
            out.snapshot
          ){
            workspaceCache.set(
              key,
              out.snapshot
            );

            workspaceStats
              .writes++;

            return out.snapshot;
          }

          return null;
        }
      )
      .finally(
        function(){
          workspaceInflight
            .delete(key);
        }
      );

  workspaceInflight.set(
    key,
    p
  );

  return p.then(
    function(s){

      if(s){
        return revive(s);
      }

      return innerFetch(
        input,
        init
      );
    }
  );
}

workspaceFetch
  .__aquilaFinanceR296=
  true;

workspaceFetch
  .__aquilaInnerFetch=
  innerFetch;

window.fetch=
  workspaceFetch;

function prewarm(){
  if(
    state.prewarmStarted ||
    !moduleName()
  ){
    return;
  }

  state.prewarmStarted=true;

  PREWARM_ENDPOINTS
    .forEach(
      function(endpoint){

        if(
          !financeUrl(
            endpoint
          )
        ){
          return;
        }

        workspaceStats
          .prewarmRequests++;

        workspaceFetch(
          endpoint,
          {
            method:'GET'
          }
        )
          .then(
            function(r){

              if(
                r &&
                r.ok
              ){
                workspaceStats
                  .prewarmSuccesses++;
              }else{
                workspaceStats
                  .prewarmErrors++;
              }
            }
          )
          .catch(
            function(){
              workspaceStats
                .prewarmErrors++;
            }
          );
      }
    );
}

/* =======================================================
   EXISTING PRESENTATION / COORDINATOR BRIDGE
   ======================================================= */

function cancelR295Loop(){
  var old=
    window
      .__AQUILA_FINANCE_R2_9_5_STATE__;

  if(
    old &&
    old.raf
  ){
    try{
      cancelAnimationFrame(
        old.raf
      );
    }catch(_){}

    old.raf=0;
  }
}

function presentationPass(){
  cancelR295Loop();

  try{
    var p=
      window
        .__AQUILA_FINANCE_R2_9_5__;

    if(
      p &&
      typeof p.present===
      'function'
    ){
      p.present();

      return;
    }
  }catch(_){}

  try{
    var p2=
      window
        .__AQUILA_FINANCE_BROWSER_REMEDIATION__;

    if(
      p2 &&
      typeof p2
        .applyPresentation===
        'function'
    ){
      p2.applyPresentation();
    }
  }catch(_){}
}

function callExistingCoordinator(
  reason
){
  try{
    var l=
      window
        .__AQUILA_FINANCE_LOADING_SETTLE__;

    if(
      l &&
      typeof l.request===
      'function'
    ){
      l.request(
        'r2.9.6-'+
        reason
      );
    }
  }catch(_){}

  try{
    var r=
      window
        .__AQUILA_FINANCE_R2_7__;

    if(
      r &&
      typeof r.apply===
      'function'
    ){
      r.apply();
    }
  }catch(_){}
}

/* =======================================================
   REACT LOADER DISCOVERY
   ======================================================= */

function reactFiber(el){
  if(!el){
    return null;
  }

  try{
    var keys=
      Object.keys(el);

    for(
      var i=0;
      i<keys.length;
      i++
    ){
      if(
        keys[i]
          .indexOf(
            '__reactFiber$'
          )===0
      ){
        return el[
          keys[i]
        ];
      }
    }
  }catch(_){}

  return null;
}

function reactProps(el){
  if(!el){
    return {};
  }

  try{
    var keys=
      Object.keys(el);

    for(
      var i=0;
      i<keys.length;
      i++
    ){
      if(
        keys[i]
          .indexOf(
            '__reactProps$'
          )===0
      ){
        return (
          el[
            keys[i]
          ] ||
          {}
        );
      }
    }
  }catch(_){}

  return {};
}

function safeFunction(fn){
  if(
    typeof fn!==
    'function'
  ){
    return false;
  }

  var src='';

  try{
    src=
      String(fn);
  }catch(_){}

  return !(
    /location\s*\.\s*reload/i
      .test(src) ||
    /window\s*\.\s*location/i
      .test(src) ||
    /history\s*\.\s*go\s*\(\s*0/i
      .test(src)
  );
}

function visibleHintNodes(){
  var module=
    moduleName();

  var hints=
    MODULE_HINTS[
      module
    ] ||
    [];

  var nodes=
    document.querySelectorAll(
      'h1,h2,h3,h4,h5,h6,' +
      '[role="heading"],' +
      '.card-title,' +
      '.section-title,' +
      'div,span,p'
    );

  var out=[];

  for(
    var i=0;
    i<nodes.length;
    i++
  ){
    if(
      !visible(
        nodes[i]
      )
    ){
      continue;
    }

    var t=
      norm(
        nodes[i]
          .textContent
      );

    if(
      hints.indexOf(t)>=0
    ){
      out.push(
        nodes[i]
      );
    }
  }

  return out;
}

function refreshButton(){
  var buttons=
    document.querySelectorAll(
      'button,' +
      '[role="button"]'
    );

  for(
    var i=0;
    i<buttons.length;
    i++
  ){
    var b=
      buttons[i];

    if(
      !visible(b) ||
      b.disabled
    ){
      continue;
    }

    var text=
      norm(
        b.textContent ||
        b.getAttribute(
          'aria-label'
        ) ||
        b.getAttribute(
          'title'
        )
      );

    if(
      !/^(Refresh|Refresh Data|Reload Data|Retry|Load Data)$/i
        .test(text)
    ){
      continue;
    }

    var p=
      reactProps(b);

    if(
      typeof p.onClick===
        'function' &&
      safeFunction(
        p.onClick
      )
    ){
      return {
        type:'button',
        element:b,
        name:text,
        score:200
      };
    }
  }

  return null;
}

function loaderFunction(){
  var seeds=
    visibleHintNodes();

  var candidates=[];

  var keysRe=
    /^(on)?(refresh|refetch|retry|reloadData|loadData|fetchData|getData|refreshData|loadFinance|reloadFinance)$/i;

  function inspectProps(
    props,
    depth
  ){
    if(
      !props ||
      typeof props!==
      'object'
    ){
      return;
    }

    Object.keys(
      props
    ).forEach(
      function(k){

        var fn=
          props[k];

        if(
          !keysRe.test(k) ||
          !safeFunction(fn)
        ){
          return;
        }

        var score=
          160-depth;

        if(
          /^onRefresh$/i
            .test(k)
        ){
          score+=25;
        }

        if(
          /^refetch$/i
            .test(k)
        ){
          score+=20;
        }

        if(
          /loadData|fetchData/i
            .test(k)
        ){
          score+=15;
        }

        candidates.push({
          type:'function',
          fn:fn,
          name:k,
          score:score
        });
      }
    );
  }

  seeds.forEach(
    function(seed){

      var fiber=
        reactFiber(seed);

      for(
        var depth=0;
        fiber &&
        depth<22;
        depth++,
        fiber=fiber.return
      ){
        inspectProps(
          fiber.memoizedProps,
          depth
        );

        if(
          fiber.pendingProps !==
          fiber.memoizedProps
        ){
          inspectProps(
            fiber.pendingProps,
            depth
          );
        }
      }
    }
  );

  candidates.sort(
    function(a,b){
      return (
        b.score-
        a.score
      );
    }
  );

  return (
    candidates[0] ||
    null
  );
}

function findLoader(){
  return (
    refreshButton() ||
    loaderFunction()
  );
}

/* =======================================================
   BOUNDED DATA-READY PRESENTATION
   ======================================================= */

function settleFrames(
  generation,
  remaining
){
  if(
    generation!==
    state.generation ||
    remaining<=0
  ){
    return;
  }

  requestAnimationFrame(
    function(){

      if(
        generation!==
        state.generation
      ){
        return;
      }

      presentationPass();

      settleFrames(
        generation,
        remaining-1
      );
    }
  );
}

function afterLoader(
  generation,
  result
){
  if(
    result &&
    typeof result.then===
      'function'
  ){
    result.then(
      function(){

        if(
          generation!==
          state.generation
        ){
          return;
        }

        state.loaderResolved=
          true;

        callExistingCoordinator(
          'loader-resolved'
        );

        settleFrames(
          generation,
          SETTLE_FRAMES
        );
      },

      function(e){

        if(
          generation!==
          state.generation
        ){
          return;
        }

        state.lastLoaderError=
          e &&
          e.message
            ? e.message
            : String(e);

        settleFrames(
          generation,
          SETTLE_FRAMES
        );
      }
    );
  }

  if(state.timer){
    clearTimeout(
      state.timer
    );
  }

  state.timer=
    setTimeout(
      function(){

        state.timer=null;

        if(
          generation!==
          state.generation
        ){
          return;
        }

        callExistingCoordinator(
          'route-settle'
        );

        settleFrames(
          generation,
          3
        );
      },
      ROUTE_SETTLE_DELAY
    );
}

function invokeLoader(
  generation
){
  var candidate=
    findLoader();

  state.loaderFound=
    !!candidate;

  state.loaderType=
    candidate
      ? candidate.type
      : null;

  state.loaderName=
    candidate
      ? candidate.name
      : null;

  state.loaderInvoked=
    false;

  state.loaderResolved=
    false;

  state.lastLoaderError=
    null;

  if(!candidate){
    afterLoader(
      generation,
      null
    );

    return;
  }

  state.loaderInvoked=
    true;

  try{
    var result;

    if(
      candidate.type===
      'button'
    ){
      result=
        reactProps(
          candidate.element
        ).onClick({
          type:'click',
          currentTarget:
            candidate.element,
          target:
            candidate.element,
          preventDefault:
            function(){},
          stopPropagation:
            function(){}
        });
    }else{
      result=
        candidate.fn();
    }

    afterLoader(
      generation,
      result
    );

  }catch(e){

    state.lastLoaderError=
      e &&
      e.message
        ? e.message
        : String(e);

    afterLoader(
      generation,
      null
    );
  }
}

/* =======================================================
   ROUTE LIFECYCLE
   ======================================================= */

var state=
  window
    .__AQUILA_FINANCE_R2_9_6_STATE__ ||
  {
    route:'',
    module:'',
    generation:0,
    routeEvents:0,
    timer:null,
    prewarmStarted:false,
    loaderFound:false,
    loaderType:null,
    loaderName:null,
    loaderInvoked:false,
    loaderResolved:false,
    lastLoaderError:null,
    lastRouteAt:null
  };

window
  .__AQUILA_FINANCE_R2_9_6_STATE__=
  state;

function handleRoute(
  reason
){
  var module=
    moduleName();

  if(!module){
    return;
  }

  var key=
    routeKey();

  if(
    state.route===key &&
    reason!=='runtime-load' &&
    reason!=='manual'
  ){
    return;
  }

  if(state.timer){
    clearTimeout(
      state.timer
    );

    state.timer=null;
  }

  cancelR295Loop();

  state.route=
    key;

  state.module=
    module;

  state.generation++;

  state.routeEvents++;

  state.lastRouteReason=
    reason;

  state.lastRouteAt=
    new Date()
      .toISOString();

  prewarm();

  callExistingCoordinator(
    'route-enter'
  );

  presentationPass();

  var generation=
    state.generation;

  requestAnimationFrame(
    function(){

      if(
        generation!==
        state.generation
      ){
        return;
      }

      cancelR295Loop();

      invokeLoader(
        generation
      );
    }
  );
}

var oldPush=
  history.pushState;

if(
  !oldPush
    .__aquilaFinanceR296
){
  var push=
    function(){

      var result=
        oldPush.apply(
          this,
          arguments
        );

      handleRoute(
        'pushState'
      );

      return result;
    };

  push
    .__aquilaFinanceR296=
    true;

  push
    .__aquilaPrevious=
    oldPush;

  history.pushState=
    push;
}

var oldReplace=
  history.replaceState;

if(
  !oldReplace
    .__aquilaFinanceR296
){
  var replace=
    function(){

      var result=
        oldReplace.apply(
          this,
          arguments
        );

      handleRoute(
        'replaceState'
      );

      return result;
    };

  replace
    .__aquilaFinanceR296=
    true;

  replace
    .__aquilaPrevious=
    oldReplace;

  history.replaceState=
    replace;
}

window.addEventListener(
  'hashchange',
  function(){
    cancelR295Loop();

    handleRoute(
      'hashchange'
    );
  }
);

window.addEventListener(
  'popstate',
  function(){
    cancelR295Loop();

    handleRoute(
      'popstate'
    );
  }
);

/* =======================================================
   DIAGNOSTICS
   ======================================================= */

window
  .__AQUILA_FINANCE_WORKSPACE_CACHE__={
  version:
    VERSION,

  invalidate:
    invalidateWorkspace,

  diagnose:
    function(){

      var entries=[];

      workspaceCache
        .forEach(
          function(v,k){

            entries.push({
              url:k,
              ageMs:
                Date.now()-
                v.at,
              status:
                v.status
            });
          }
        );

      return {
        version:
          VERSION,

        entries:
          entries,

        inflight:
          workspaceInflight
            .size,

        stats:
          Object.assign(
            {},
            workspaceStats
          )
      };
    }
,
invalidateAll:function(){workspaceCache.clear();workspaceInflight.clear();workspaceStats.invalidations=(workspaceStats.invalidations||0)+1;return true;},
};

window
  .__AQUILA_FINANCE_R2_9_6__={
  version:
    VERSION,

  start:
    function(){
      handleRoute(
        'manual'
      );
    },

  diagnose:
    function(){

      var old=null;

      try{
        if(
          window
            .__AQUILA_FINANCE_R2_9_5__ &&
          typeof window
            .__AQUILA_FINANCE_R2_9_5__
            .diagnose===
            'function'
        ){
          old=
            window
              .__AQUILA_FINANCE_R2_9_5__
              .diagnose();
        }
      }catch(e){
        old={
          error:
            e &&
            e.message
              ? e.message
              : String(e)
        };
      }

      return {
        version:
          VERSION,

        route:
          routeKey(),

        module:
          moduleName(),

        routeLifecycle:{
          generation:
            state.generation,

          routeEvents:
            state.routeEvents,

          lastRouteReason:
            state.lastRouteReason,

          lastRouteAt:
            state.lastRouteAt
        },

        softBootstrap:{
          loaderFound:
            state.loaderFound,

          loaderType:
            state.loaderType,

          loaderName:
            state.loaderName,

          loaderInvoked:
            state.loaderInvoked,

          loaderResolved:
            state.loaderResolved,

          lastLoaderError:
            state.lastLoaderError
        },

        prewarm:{
          endpointCount:
            PREWARM_ENDPOINTS
              .length,

          started:
            state.prewarmStarted
        },

        workspaceCache:
          window
            .__AQUILA_FINANCE_WORKSPACE_CACHE__
            .diagnose(),

        previousR295:
          old
      };
    }
};

cancelR295Loop();

handleRoute(
  'runtime-load'
);

})();
(function(){
'use strict';

var VERSION='R2.9.7';

var MAX_EFFECTS=3;
var MAX_FIBER_DEPTH=24;
var MAX_HOOKS=80;
var MAX_SETTLE_FRAMES=150;
var PRESENT_EVERY=12;

var TARGETS={
  overview:[
    'Revenue vs Expenses Trend',
    'Cash Flow Overview'
  ],

  'financial-statements':[
    'Income vs Expenses',
    'Net Profit Trend'
  ],

  'profit-loss':[
    'Income vs Expenses',
    'Net Profit Trend'
  ],

  'cash-flow':[
    'Cash Inflow vs Cash Outflow',
    'Net Cash Flow Trend'
  ],

  cashflow:[
    'Cash Inflow vs Cash Outflow',
    'Net Cash Flow Trend'
  ],

  sales:[
    'Sales vs Returns',
    'Revenue Trend'
  ]
};

var GRANULARITY={
  'Revenue vs Expenses Trend':'monthly',
  'Cash Flow Overview':'monthly',
  'Income vs Expenses':'daily',
  'Net Profit Trend':'daily',
  'Cash Inflow vs Cash Outflow':'daily',
  'Net Cash Flow Trend':'daily',
  'Sales vs Returns':'daily',
  'Revenue Trend':'daily'
};

var HINTS={
  overview:[
    'Finance Overview',
    'Revenue vs Expenses Trend',
    'Cash Flow Overview',
    'Recent Transactions',
    'Top Receivables'
  ],

  'financial-statements':[
    'Profit & Loss',
    'Profit and Loss',
    'Income vs Expenses',
    'Net Profit Trend'
  ],

  'profit-loss':[
    'Profit & Loss',
    'Profit and Loss',
    'Income vs Expenses',
    'Net Profit Trend'
  ],

  'cash-flow':[
    'Cash Flow',
    'Cash Inflow vs Cash Outflow',
    'Net Cash Flow Trend'
  ],

  cashflow:[
    'Cash Flow',
    'Cash Inflow vs Cash Outflow',
    'Net Cash Flow Trend'
  ],

  sales:[
    'Sales',
    'Sales vs Returns',
    'Revenue Trend'
  ]
};

function norm(v){
  return String(
    v==null
      ? ''
      : v
  )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function numeric(v){
  if(
    typeof v==='number' &&
    isFinite(v)
  ){
    return v;
  }

  if(
    typeof v==='string' &&
    v.trim()!=='' &&
    isFinite(Number(v))
  ){
    return Number(v);
  }

  return null;
}

function visible(el){
  if(
    !el ||
    !el.isConnected
  ){
    return false;
  }

  var style=
    getComputedStyle(el);

  var rect=
    el.getBoundingClientRect();

  return (
    style.display!=='none' &&
    style.visibility!=='hidden' &&
    rect.width>0 &&
    rect.height>0
  );
}

function params(){
  try{
    return new URLSearchParams(
      String(
        location.hash ||
        ''
      )
        .replace(
          /^#/,
          ''
        )
    );
  }catch(_){
    return new URLSearchParams();
  }
}

function moduleName(){
  var p=params();

  if(
    p.get('section')!=='finance' &&
    !p.get('finance')
  ){
    return '';
  }

  return (
    p.get('finance') ||
    'overview'
  );
}

function routeKey(){
  var p=params();

  p.delete(
    'scrollY'
  );

  return (
    location.pathname+
    location.search+
    '#'+
    p.toString()
  );
}

function exactNode(text){
  var nodes=
    document.querySelectorAll(
      'h1,h2,h3,h4,h5,h6,' +
      '[role="heading"],' +
      '.card-title,' +
      '.section-title,' +
      'div,span,p'
    );

  for(
    var i=0;
    i<nodes.length;
    i++
  ){
    if(
      visible(nodes[i]) &&
      norm(
        nodes[i].textContent
      )===text
    ){
      return nodes[i];
    }
  }

  return null;
}

function cardFor(
  title,
  required
){
  var h=
    exactNode(title);

  if(!h){
    return null;
  }

  for(
    var e=h,d=0;
    e && d<10;
    d++,
    e=e.parentElement
  ){
    if(!e.querySelector){
      continue;
    }

    if(
      required
        ? e.querySelector(
            required
          )
        : e.querySelector(
            'svg,canvas,table'
          )
    ){
      return e;
    }
  }

  return h.parentElement;
}

/* =======================================================
   CANCEL OLDER ROUTE OWNERSHIP LOOPS
   ======================================================= */

function cancelOlderLoops(){

  try{
    var s295=
      window
        .__AQUILA_FINANCE_R2_9_5_STATE__;

    if(
      s295 &&
      s295.raf
    ){
      cancelAnimationFrame(
        s295.raf
      );

      s295.raf=0;
    }
  }catch(_){}

  try{
    var s296=
      window
        .__AQUILA_FINANCE_R2_9_6_STATE__;

    if(
      s296 &&
      s296.timer
    ){
      clearTimeout(
        s296.timer
      );

      s296.timer=null;
    }
  }catch(_){}
}

/* =======================================================
   REACT FIBER / EFFECT DISCOVERY
   ======================================================= */

function fiberOf(el){
  if(!el){
    return null;
  }

  try{
    var keys=
      Object.keys(el);

    for(
      var i=0;
      i<keys.length;
      i++
    ){
      if(
        keys[i]
          .indexOf(
            '__reactFiber$'
          )===0
      ){
        return el[
          keys[i]
        ];
      }
    }
  }catch(_){}

  return null;
}

function sourceOf(fn){
  try{
    return String(fn);
  }catch(_){
    return '';
  }
}

function safeEffect(fn){
  if(
    typeof fn!==
    'function'
  ){
    return false;
  }

  var src=
    sourceOf(fn);

  if(
    !src ||
    src.length>12000
  ){
    return false;
  }

  if(
    /MutationObserver|setInterval|addEventListener\s*\(\s*['"](?:focus|visibilitychange)|location\s*\.|history\s*\.|localStorage|sessionStorage|analytics|telemetry|trackEvent|logEvent/i
      .test(src)
  ){
    return false;
  }

  return true;
}

function effectScore(
  fn,
  depth,
  module
){
  var src=
    sourceOf(fn);

  var score=
    120-depth;

  if(
    /fetch|axios|request|api|load|refresh|refetch|getData/i
      .test(src)
  ){
    score+=50;
  }

  if(
    /finance|financial|ledger|journal|receiv|payable|transaction/i
      .test(src)
  ){
    score+=40;
  }

  if(
    module==='sales' &&
    /sales|return|refund|revenue/i
      .test(src)
  ){
    score+=45;
  }

  if(
    (
      module==='cash-flow' ||
      module==='cashflow'
    ) &&
    /cash|inflow|outflow/i
      .test(src)
  ){
    score+=45;
  }

  if(
    (
      module==='financial-statements' ||
      module==='profit-loss'
    ) &&
    /profit|loss|income|expense|statement/i
      .test(src)
  ){
    score+=45;
  }

  return score;
}

function pushEffect(
  out,
  seen,
  fn,
  depth,
  module,
  source
){
  if(
    !safeEffect(fn) ||
    seen.indexOf(fn)>=0
  ){
    return;
  }

  seen.push(fn);

  out.push({
    fn:fn,
    score:
      effectScore(
        fn,
        depth,
        module
      ),
    depth:depth,
    source:source
  });
}

function inspectEffectRing(
  effect,
  out,
  seen,
  depth,
  module,
  source
){
  if(
    !effect ||
    typeof effect!==
    'object'
  ){
    return;
  }

  var first=
    effect;

  var current=
    effect;

  var count=0;

  while(
    current &&
    count<40
  ){
    if(
      typeof current.create===
      'function'
    ){
      pushEffect(
        out,
        seen,
        current.create,
        depth,
        module,
        source
      );
    }

    current=
      current.next;

    count++;

    if(
      !current ||
      current===first
    ){
      break;
    }
  }
}

function inspectFiber(
  fiber,
  depth,
  module,
  out,
  seen
){
  if(!fiber){
    return;
  }

  var hook=
    fiber.memoizedState;

  var hookCount=0;

  while(
    hook &&
    hookCount<
      MAX_HOOKS
  ){
    var m=
      hook.memoizedState;

    if(
      m &&
      typeof m===
      'object'
    ){
      if(
        typeof m.create===
        'function'
      ){
        pushEffect(
          out,
          seen,
          m.create,
          depth,
          module,
          'hook'
        );
      }

      if(
        m.next &&
        typeof m.next===
        'object'
      ){
        inspectEffectRing(
          m,
          out,
          seen,
          depth,
          module,
          'hook-ring'
        );
      }
    }

    hook=
      hook.next;

    hookCount++;
  }

  var q=
    fiber.updateQueue;

  if(
    q &&
    q.lastEffect
  ){
    inspectEffectRing(
      q.lastEffect.next ||
      q.lastEffect,
      out,
      seen,
      depth,
      module,
      'updateQueue'
    );
  }
}

function seedNodes(){
  var module=
    moduleName();

  var hints=
    HINTS[module] ||
    [];

  var out=[];

  hints.forEach(
    function(text){

      var e=
        exactNode(text);

      if(
        e &&
        out.indexOf(e)<0
      ){
        out.push(e);
      }
    }
  );

  if(!out.length){
    var main=
      document.querySelector(
        'main,[role="main"]'
      );

    if(main){
      out.push(main);
    }
  }

  return out;
}

function discoverEffects(){
  var module=
    moduleName();

  var out=[];
  var seen=[];

  seedNodes()
    .forEach(
      function(seed){

        var fiber=
          fiberOf(seed);

        for(
          var depth=0;
          fiber &&
          depth<
            MAX_FIBER_DEPTH;
          depth++,
          fiber=fiber.return
        ){
          inspectFiber(
            fiber,
            depth,
            module,
            out,
            seen
          );
        }
      }
    );

  out.sort(
    function(a,b){
      return (
        b.score-
        a.score
      );
    }
  );

  return out;
}

function replayDataEffects(){
  var candidates=
    discoverEffects();

  var invoked=[];

  for(
    var i=0;
    i<candidates.length &&
    invoked.length<
      MAX_EFFECTS;
    i++
  ){
    var c=
      candidates[i];

    try{
      c.fn();

      invoked.push({
        score:
          c.score,

        depth:
          c.depth,

        source:
          c.source,

        signature:
          sourceOf(
            c.fn
          )
            .slice(
              0,
              160
            )
      });

    }catch(e){

      invoked.push({
        score:
          c.score,

        depth:
          c.depth,

        source:
          c.source,

        error:
          e &&
          e.message
            ? e.message
            : String(e)
      });
    }
  }

  return {
    discovered:
      candidates.length,

    invoked:
      invoked
  };
}

/* =======================================================
   EXISTING COORDINATOR
   ======================================================= */

function coordinator(reason){
  try{
    var loading=
      window
        .__AQUILA_FINANCE_LOADING_SETTLE__;

    if(
      loading &&
      typeof loading.request===
      'function'
    ){
      loading.request(
        'r2.9.7-'+reason
      );
    }
  }catch(_){}

  try{
    var r27=
      window
        .__AQUILA_FINANCE_R2_7__;

    if(
      r27 &&
      typeof r27.apply===
      'function'
    ){
      r27.apply();
    }
  }catch(_){}
}

/* =======================================================
   STRONGER CHART PRESENTATION
   ======================================================= */

function ensureCss(){
  if(
    document.getElementById(
      'aquila-finance-r297-css'
    )
  ){
    return;
  }

  var s=
    document.createElement(
      'style'
    );

  s.id=
    'aquila-finance-r297-css';

  s.textContent=[
    'body[data-aquila-finance-active="1"] .recharts-cartesian-grid{display:none!important;opacity:0!important}',
    'body[data-aquila-finance-active="1"] .recharts-cartesian-grid-horizontal{display:none!important;opacity:0!important}',
    'body[data-aquila-finance-active="1"] .recharts-cartesian-grid-vertical{display:none!important;opacity:0!important}',
    '.aquila-r297-chart-scroll{overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain}',
    '.aquila-r297-axis{display:grid;align-items:start;font-size:11px;line-height:1.2;padding:5px 4px 2px;box-sizing:border-box}',
    '.aquila-r297-axis span{text-align:center;white-space:nowrap;padding:0 3px}',
    '[data-aquila-r297-recent] table{width:100%!important;table-layout:auto!important;border-collapse:collapse!important}',
    '[data-aquila-r297-recent] th,[data-aquila-r297-recent] td{white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;padding-left:5px!important;padding-right:5px!important;font-size:12px!important;line-height:1.25!important}',
    '[data-aquila-r297-recent-scroll]{overflow-x:auto!important;overflow-y:auto!important}',
    '[data-aquila-r297-receivables] table{width:100%!important;table-layout:auto!important}',
    '[data-aquila-r297-receivables] th,[data-aquila-r297-receivables] td{white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}',
    '[data-aquila-r297-receivables-scroll]{overflow-x:auto!important;overflow-y:auto!important}'
  ].join('\n');

  document.head
    .appendChild(s);
}

function reactProps(el){
  if(!el){
    return {};
  }

  try{
    var keys=
      Object.keys(el);

    for(
      var i=0;
      i<keys.length;
      i++
    ){
      if(
        keys[i]
          .indexOf(
            '__reactProps$'
          )===0
      ){
        return (
          el[
            keys[i]
          ] ||
          {}
        );
      }
    }

    var fiber=
      fiberOf(el);

    for(
      var depth=0;
      fiber &&
      depth<7;
      depth++,
      fiber=fiber.return
    ){
      if(
        fiber.memoizedProps
      ){
        return fiber.memoizedProps;
      }
    }

  }catch(_){}

  return {};
}

function valueFrom(
  obj
){
  if(!obj){
    return null;
  }

  var v=
    numeric(
      obj.value
    );

  if(v!==null){
    return v;
  }

  if(
    Array.isArray(
      obj.value
    )
  ){
    for(
      var i=obj.value.length-1;
      i>=0;
      i--
    ){
      v=numeric(
        obj.value[i]
      );

      if(v!==null){
        return v;
      }
    }
  }

  if(
    obj.payload &&
    obj.dataKey
  ){
    v=
      numeric(
        obj.payload[
          obj.dataKey
        ]
      );

    if(v!==null){
      return v;
    }
  }

  if(
    obj.payload
  ){
    for(
      var key in
      obj.payload
    ){
      if(
        !Object.prototype
          .hasOwnProperty
          .call(
            obj.payload,
            key
          )
      ){
        continue;
      }

      if(
        /date|day|month|period|name|label|id/i
          .test(key)
      ){
        continue;
      }

      v=numeric(
        obj.payload[key]
      );

      if(v!==null){
        return v;
      }
    }
  }

  if(
    Array.isArray(
      obj.tooltipPayload
    )
  ){
    for(
      var j=0;
      j<
        obj.tooltipPayload.length;
      j++
    ){
      v=numeric(
        obj.tooltipPayload[j]
          .value
      );

      if(v!==null){
        return v;
      }
    }
  }

  return null;
}

function dateFrom(
  obj
){
  if(
    !obj ||
    typeof obj!==
    'object'
  ){
    return '';
  }

  var source=
    obj.payload &&
    typeof obj.payload===
    'object'
      ? obj.payload
      : obj;

  var keys=[
    'date',
    'day',
    'period',
    'month',
    'posting_date',
    'transaction_date',
    'created_at',
    'updated_at'
  ];

  for(
    var i=0;
    i<keys.length;
    i++
  ){
    var v=
      norm(
        source[
          keys[i]
        ]
      );

    if(v){
      return v;
    }
  }

  return '';
}

function compactDate(
  value,
  granularity
){
  var s=
    norm(value);

  if(!s){
    return '';
  }

  var d=
    new Date(s);

  if(
    !isNaN(
      d.getTime()
    )
  ){
    return d
      .toLocaleDateString(
        undefined,
        granularity===
        'monthly'
          ? {
              month:'short',
              year:'numeric'
            }
          : {
              month:'short',
              day:'2-digit'
            }
      );
  }

  return s;
}

function formatValue(v){
  var a=
    Math.abs(v);

  if(a>=1000000000){
    return (
      v/1000000000
    )
      .toFixed(
        a>=10000000000
          ? 0
          : 1
      )
      .replace(
        /\.0$/,
        ''
      )+'B';
  }

  if(a>=1000000){
    return (
      v/1000000
    )
      .toFixed(
        a>=10000000
          ? 0
          : 1
      )
      .replace(
        /\.0$/,
        ''
      )+'M';
  }

  if(a>=1000){
    return (
      v/1000
    )
      .toFixed(
        a>=10000
          ? 0
          : 1
      )
      .replace(
        /\.0$/,
        ''
      )+'K';
  }

  return String(
    Math.round(
      v*100
    )/100
  );
}

function addSvgLabel(
  svg,
  x,
  y,
  value
){
  var ns=
    'http://www.w3.org/2000/svg';

  var g=
    document
      .createElementNS(
        ns,
        'g'
      );

  g.setAttribute(
    'data-aquila-r297-label',
    '1'
  );

  g.setAttribute(
    'pointer-events',
    'none'
  );

  var text=
    document
      .createElementNS(
        ns,
        'text'
      );

  text.setAttribute(
    'x',
    String(x)
  );

  text.setAttribute(
    'y',
    String(y)
  );

  text.setAttribute(
    'text-anchor',
    'middle'
  );

  text.setAttribute(
    'dominant-baseline',
    'middle'
  );

  text.setAttribute(
    'fill',
    '#fff'
  );

  text.setAttribute(
    'font-size',
    '10'
  );

  text.setAttribute(
    'font-weight',
    '700'
  );

  text.textContent=
    formatValue(value);

  g.appendChild(text);
  svg.appendChild(g);

  try{
    var box=
      text.getBBox();

    var rect=
      document
        .createElementNS(
          ns,
          'rect'
        );

    rect.setAttribute(
      'x',
      String(
        box.x-4
      )
    );

    rect.setAttribute(
      'y',
      String(
        box.y-2
      )
    );

    rect.setAttribute(
      'width',
      String(
        box.width+8
      )
    );

    rect.setAttribute(
      'height',
      String(
        box.height+4
      )
    );

    rect.setAttribute(
      'rx',
      '3'
    );

    rect.setAttribute(
      'fill',
      '#000'
    );

    g.insertBefore(
      rect,
      text
    );

    return true;

  }catch(_){

    g.remove();

    return false;
  }
}

function pointCollections(
  card
){
  var collections=[];

  card.querySelectorAll(
    '.recharts-line,' +
    '.recharts-area,' +
    '.recharts-scatter'
  ).forEach(
    function(series){

      var probes=[
        series,
        series.querySelector(
          '.recharts-line-curve'
        ),
        series.querySelector(
          '.recharts-area-curve'
        ),
        series.querySelector(
          'path'
        )
      ].filter(Boolean);

      for(
        var i=0;
        i<probes.length;
        i++
      ){
        var props=
          reactProps(
            probes[i]
          );

        if(
          Array.isArray(
            props.points
          ) &&
          props.points.length
        ){
          collections.push(
            props.points
          );

          break;
        }
      }
    }
  );

  return collections;
}

function addChartLabels(
  card
){
  var svg=
    card.querySelector(
      'svg'
    );

  if(!svg){
    return 0;
  }

  svg.querySelectorAll(
    '[data-aquila-r297-label="1"],' +
    '[data-aquila-r295-label="1"],' +
    '[data-aquila-value-label="1"]'
  ).forEach(
    function(el){
      el.remove();
    }
  );

  var count=0;
  var seen={};

  card.querySelectorAll(
    '.recharts-bar-rectangle'
  ).forEach(
    function(wrapper){

      var shape=
        wrapper.querySelector(
          'path,rect'
        ) ||
        wrapper;

      if(!shape.getBBox){
        return;
      }

      var value=
        valueFrom(
          reactProps(
            wrapper
          )
        );

      if(value===null){
        value=
          valueFrom(
            reactProps(
              shape
            )
          );
      }

      if(value===null){
        return;
      }

      try{
        var box=
          shape.getBBox();

        var x=
          box.x+
          box.width/2;

        var y=
          value<0
            ? box.y+
              box.height+
              10
            : Math.max(
                12,
                box.y-8
              );

        if(
          addSvgLabel(
            svg,
            x,
            y,
            value
          )
        ){
          count++;
        }
      }catch(_){}
    }
  );

  pointCollections(card)
    .forEach(
      function(points){

        points.forEach(
          function(point){

            var x=
              numeric(
                point &&
                point.x
              );

            var y=
              numeric(
                point &&
                point.y
              );

            var value=
              valueFrom(point);

            if(
              x===null ||
              y===null ||
              value===null
            ){
              return;
            }

            var key=
              Math.round(x)+
              '|'+
              Math.round(y)+
              '|'+
              value;

            if(seen[key]){
              return;
            }

            seen[key]=true;

            if(
              addSvgLabel(
                svg,
                x,
                Math.max(
                  12,
                  y-10
                ),
                value
              )
            ){
              count++;
            }
          }
        );
      }
    );

  return count;
}

function genuinePayloadDates(
  card,
  granularity
){
  var out=[];

  function add(v){
    var compact=
      compactDate(
        v,
        granularity
      );

    if(
      compact &&
      out.indexOf(
        compact
      )<0
    ){
      out.push(compact);
    }
  }

  pointCollections(card)
    .forEach(
      function(points){

        points.forEach(
          function(point){
            add(
              dateFrom(point)
            );
          }
        );
      }
    );

  card.querySelectorAll(
    '.recharts-bar-rectangle'
  ).forEach(
    function(el){

      add(
        dateFrom(
          reactProps(el)
        )
      );
    }
  );

  return out;
}

function nativeXAxisDates(
  card
){
  var out=[];

  card.querySelectorAll(
    '.recharts-xAxis text,' +
    '.recharts-xAxis ' +
    '.recharts-cartesian-axis-tick-value'
  ).forEach(
    function(el){

      var text=
        norm(
          el.textContent
        );

      if(
        text &&
        out.indexOf(text)<0
      ){
        out.push(text);
      }
    }
  );

  return out;
}

function applyAxis(
  card,
  title
){
  var granularity=
    GRANULARITY[title] ||
    'daily';

  var nativeDates=
    nativeXAxisDates(card);

  var payloadDates=
    genuinePayloadDates(
      card,
      granularity
    );

  var labels=
    payloadDates.length>=2
      ? payloadDates
      : nativeDates;

  var wrapper=
    card.querySelector(
      '.recharts-wrapper'
    ) ||
    card.querySelector(
      'svg'
    );

  if(!wrapper){
    return {
      labels:0,
      scroll:false,
      source:'none'
    };
  }

  var host=
    wrapper.parentElement &&
    card.contains(
      wrapper.parentElement
    )
      ? wrapper.parentElement
      : card;

  var oldLeft=
    host.scrollLeft ||
    0;

  host.classList.add(
    'aquila-r297-chart-scroll'
  );

  host.querySelectorAll(
    '.aquila-r297-axis'
  ).forEach(
    function(el){
      el.remove();
    }
  );

  var minWidth=
    Math.max(
      Math.round(
        card
          .getBoundingClientRect()
          .width ||
        0
      ),

      labels.length*
      (
        granularity===
        'monthly'
          ? 105
          : 76
      )
    );

  if(
    wrapper.style &&
    labels.length
  ){
    wrapper.style
      .minWidth=
      minWidth+'px';
  }

  if(
    payloadDates.length>=2 &&
    (
      nativeDates.length<
      payloadDates.length
    )
  ){
    var strip=
      document
        .createElement(
          'div'
        );

    strip.className=
      'aquila-r297-axis';

    strip.setAttribute(
      'data-granularity',
      granularity
    );

    strip.style
      .gridTemplateColumns=
      'repeat('+
      payloadDates.length+
      ',minmax(68px,1fr))';

    strip.style
      .minWidth=
      minWidth+'px';

    payloadDates
      .forEach(
        function(value){

          var span=
            document
              .createElement(
                'span'
              );

          span.textContent=
            value;

          strip.appendChild(
            span
          );
        }
      );

    host.appendChild(
      strip
    );
  }

  host.scrollLeft=
    oldLeft;

  return {
    labels:
      labels.length,

    scroll:
      host.scrollWidth>
      host.clientWidth+2,

    source:
      payloadDates.length>=2
        ? 'genuine-payload'
        : 'native'
  };
}

function applyChart(
  title
){
  var card=
    cardFor(title);

  if(!card){
    return {
      title:title,
      found:false
    };
  }

  card.querySelectorAll(
    '.recharts-cartesian-grid'
  ).forEach(
    function(grid){

      grid.style.setProperty(
        'display',
        'none',
        'important'
      );

      grid.style.setProperty(
        'opacity',
        '0',
        'important'
      );
    }
  );

  var axis=
    applyAxis(
      card,
      title
    );

  var labels=
    addChartLabels(card);

  return {
    title:title,
    found:true,

    granularity:
      GRANULARITY[title],

    dataLabels:
      labels,

    xAxisLabels:
      axis.labels,

    xAxisSource:
      axis.source,

    horizontalScrollable:
      axis.scroll,

    gridVisible:
      Array.prototype
        .some.call(
          card.querySelectorAll(
            '.recharts-cartesian-grid'
          ),
          visible
        )
  };
}

/* =======================================================
   FIVE-ROW TABLES
   ======================================================= */

function fiveRows(
  table,
  marker
){
  var parent=
    table.parentElement;

  if(!parent){
    return false;
  }

  var oldTop=
    parent.scrollTop ||
    0;

  var rows=
    table.querySelectorAll(
      'tbody tr'
    );

  parent.setAttribute(
    marker,
    '1'
  );

  if(rows.length>5){
    var height=0;

    var head=
      table.querySelector(
        'thead'
      );

    if(head){
      height+=
        head
          .getBoundingClientRect()
          .height;
    }

    for(
      var i=0;
      i<5;
      i++
    ){
      height+=
        rows[i]
          .getBoundingClientRect()
          .height ||
        38;
    }

    parent.style.setProperty(
      'max-height',
      Math.ceil(
        height+2
      )+'px',
      'important'
    );

    parent.style.setProperty(
      'overflow-y',
      'auto',
      'important'
    );

    parent.style.setProperty(
      'overflow-x',
      'auto',
      'important'
    );
  }

  parent.scrollTop=
    oldTop;

  return (
    parent.scrollHeight>
    parent.clientHeight+2
  );
}

function recentCard(){
  var titles=[
    'Recent Transactions',
    'Recent Sales Transactions',
    'Recent Sales Transaction'
  ];

  for(
    var i=0;
    i<titles.length;
    i++
  ){
    var card=
      cardFor(
        titles[i],
        'table'
      );

    if(card){
      return card;
    }
  }

  return null;
}

function applyRecent(){
  var card=
    recentCard();

  if(!card){
    return {
      found:false
    };
  }

  var table=
    card.querySelector(
      'table'
    );

  if(!table){
    return {
      found:false
    };
  }

  card.setAttribute(
    'data-aquila-r297-recent',
    '1'
  );

  table.querySelectorAll(
    'th,td'
  ).forEach(
    function(cell){

      cell.style.setProperty(
        'white-space',
        'nowrap',
        'important'
      );

      cell.style.setProperty(
        'overflow',
        'visible',
        'important'
      );

      cell.style.setProperty(
        'text-overflow',
        'clip',
        'important'
      );

      var text=
        norm(
          cell.textContent
        );

      if(text){
        cell.title=
          text;
      }
    }
  );

  var scrolling=
    fiveRows(
      table,
      'data-aquila-r297-recent-scroll'
    );

  return {
    found:true,

    rows:
      table.querySelectorAll(
        'tbody tr'
      ).length,

    columns:
      table.querySelectorAll(
        'thead th'
      ).length,

    verticalScrollable:
      scrolling
  };
}

/* =======================================================
   TOP RECEIVABLES
   ======================================================= */

function ageingValue(value){
  var text=
    norm(value);

  if(!text){
    return '—';
  }

  if(
    /^\d+$/
      .test(text)
  ){
    return text;
  }

  var d=
    new Date(text);

  if(
    isNaN(
      d.getTime()
    )
  ){
    return '—';
  }

  var now=
    new Date();

  var today=
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  var then=
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    );

  var days=
    Math.floor(
      (
        today-
        then
      )/
      86400000
    );

  return days>=0
    ? String(days)
    : '—';
}

function applyReceivables(){
  var card=
    cardFor(
      'Top Receivables',
      'table'
    );

  if(!card){
    return {
      found:false
    };
  }

  var table=
    card.querySelector(
      'table'
    );

  if(!table){
    return {
      found:false
    };
  }

  card.setAttribute(
    'data-aquila-r297-receivables',
    '1'
  );

  var headers=
    Array.prototype
      .slice.call(
        table.querySelectorAll(
          'thead th'
        )
      );

  var names=
    headers.map(
      function(header){
        return norm(
          header.textContent
        )
          .toLowerCase();
      }
    );

  function indexOf(regex){
    for(
      var i=0;
      i<names.length;
      i++
    ){
      if(
        regex.test(
          names[i]
        )
      ){
        return i;
      }
    }

    return -1;
  }

  var insurer=
    indexOf(
      /insurer|insurance|provider|insurance company|partner/
    );

  var customer=
    indexOf(
      /customer|patient|member|payer|client|customer name|patient name/
    );

  var outstanding=
    indexOf(
      /outstanding|balance|amount due|receivable|due amount|balance due/
    );

  var ageing=
    indexOf(
      /ageing|aging|days outstanding|age days|issue date|invoice date|transaction date|posting date|due date|date/
    );

  var safe=
    customer>=0 &&
    outstanding>=0 &&
    headers.length>=4;

  if(safe){
    table.querySelectorAll(
      'tbody tr'
    ).forEach(
      function(row){

        var cells=
          Array.prototype
            .slice.call(
              row.children
            );

        if(
          cells.length<
          headers.length
        ){
          return;
        }

        var values=[
          insurer>=0
            ? (
                norm(
                  cells[insurer]
                    .textContent
                ) ||
                '—'
              )
            : '—',

          norm(
            cells[customer]
              .textContent
          ) ||
          '—',

          norm(
            cells[outstanding]
              .textContent
          ) ||
          '—',

          ageing>=0
            ? ageingValue(
                cells[ageing]
                  .textContent
              )
            : '—'
        ];

        for(
          var i=0;
          i<4;
          i++
        ){
          cells[i]
            .textContent=
            values[i];

          cells[i]
            .title=
            values[i];

          cells[i]
            .style.display=
            '';

          cells[i]
            .style.setProperty(
              'white-space',
              'nowrap',
              'important'
            );

          cells[i]
            .style.setProperty(
              'overflow',
              'visible',
              'important'
            );

          cells[i]
            .style.setProperty(
              'text-overflow',
              'clip',
              'important'
            );
        }

        for(
          var j=4;
          j<cells.length;
          j++
        ){
          cells[j]
            .style.display=
            'none';
        }
      }
    );

    [
      'Insurer',
      'Customer',
      'Outstanding',
      'Ageing (Days)'
    ].forEach(
      function(value,index){

        headers[index]
          .textContent=
          value;

        headers[index]
          .style.display=
          '';
      }
    );

    for(
      var h=4;
      h<headers.length;
      h++
    ){
      headers[h]
        .style.display=
        'none';
    }
  }

  var scrolling=
    fiveRows(
      table,
      'data-aquila-r297-receivables-scroll'
    );

  return {
    found:true,

    mappingSafe:
      safe,

    projectedFourColumns:
      safe,

    sourceHeaders:
      names,

    rows:
      table.querySelectorAll(
        'tbody tr'
      ).length,

    verticalScrollable:
      scrolling
  };
}

/* =======================================================
   SALES RETURNS SOURCE AUDIT
   ======================================================= */

function salesReturnAudit(){
  var card=
    cardFor(
      'Sales vs Returns'
    );

  if(!card){
    return {
      found:false
    };
  }

  var returnKeys={};
  var paidKeys={};

  function inspect(obj){
    if(
      !obj ||
      typeof obj!==
      'object'
    ){
      return;
    }

    var payload=
      obj.payload &&
      typeof obj.payload===
      'object'
        ? obj.payload
        : obj;

    Object.keys(
      payload
    ).forEach(
      function(key){

        if(
          /refund|return/i
            .test(key)
        ){
          returnKeys[key]=true;
        }

        if(
          /paid|payment/i
            .test(key)
        ){
          paidKeys[key]=true;
        }
      }
    );
  }

  pointCollections(card)
    .forEach(
      function(points){

        points.forEach(
          inspect
        );
      }
    );

  card.querySelectorAll(
    '.recharts-bar-rectangle'
  ).forEach(
    function(el){
      inspect(
        reactProps(el)
      );
    }
  );

  return {
    found:true,

    genuineReturnKeys:
      Object.keys(
        returnKeys
      ),

    paidKeys:
      Object.keys(
        paidKeys
      ),

    refundOnlySourceProven:
      Object.keys(
        returnKeys
      ).length>0
  };
}

/* =======================================================
   PRESENTATION PASS
   ======================================================= */

function present(){
  ensureCss();

  if(
    document.body
  ){
    document.body
      .setAttribute(
        'data-aquila-finance-active',
        '1'
      );
  }

  var y=
    scrollY;

  var charts=
    Object.keys(
      GRANULARITY
    ).map(
      applyChart
    );

  var recent=
    applyRecent();

  var receivables=
    applyReceivables();

  if(scrollY!==y){
    scrollTo(
      scrollX,
      y
    );
  }

  state.lastPresentation={
    at:
      new Date()
        .toISOString(),

    charts:
      charts,

    recentTransactions:
      recent,

    topReceivables:
      receivables,

    salesReturns:
      salesReturnAudit()
  };

  return state
    .lastPresentation;
}

/* =======================================================
   READINESS / BOUNDED SETTLE
   ======================================================= */

function moduleReady(){
  var targets=
    TARGETS[
      moduleName()
    ] ||
    [];

  if(!targets.length){
    return {
      known:false,
      ready:false,
      found:0,
      total:0
    };
  }

  var found=0;

  targets.forEach(
    function(title){

      var card=
        cardFor(title);

      if(
        card &&
        card.querySelector(
          '.recharts-bar-rectangle,' +
          '.recharts-line-curve,' +
          '.recharts-line-dot,' +
          '.recharts-area-curve,' +
          '.recharts-scatter-symbol'
        )
      ){
        found++;
      }
    }
  );

  return {
    known:true,
    ready:
      found===
      targets.length,

    found:
      found,

    total:
      targets.length
  };
}

function settle(
  generation,
  frame
){
  if(
    generation!==
    state.generation
  ){
    return;
  }

  if(
    generation===
      state.generation &&
    state.directBindingResolved!==
      true &&
    state.directBindingStarted!==
      true &&
    (
      state.directBindingAttempts ||
      0
    )<3
  ){
    var directApi=
      window
        .__AQUILA_FINANCE_LIVE_DATA_R1__;

    if(
      directApi &&
      typeof directApi.rootReady===
        'function' &&
      typeof directApi.applyActiveModule===
        'function' &&
      directApi.rootReady()
    ){
      state.directBindingStarted=
        true;

      state.directBindingAttempts=
        (
          state.directBindingAttempts ||
          0
        )+1;

      state.lastBinding={
        status:
          'started',

        attempt:
          state.directBindingAttempts,

        module:
          moduleName(),

        startedAt:
          new Date()
            .toISOString()
      };

      try{
        var directResult=
          directApi
            .applyActiveModule(
              'r2.9.9-direct-route-rebind'
            );

        if(
          directResult &&
          typeof directResult.then===
            'function'
        ){
          directResult.then(
            function(result){
              if(
                generation!==
                  state.generation
              ){
                return;
              }

              if(
                result &&
                result.ok===
                  true
              ){
                state.directBindingResolved=
                  true;

                state.directBindingStarted=
                  false;

                state.lastBindingError=
                  null;

                state.lastBinding={
                  status:
                    'resolved',

                  attempt:
                    state.directBindingAttempts,

                  module:
                    result.module,

                  bindingStatus:
                    result.status,

                  binding:
                    result.binding,

                  resolvedAt:
                    new Date()
                      .toISOString()
                };

                coordinator(
                  'direct-binding-resolved'
                );

                (present(),stabilizePresentation());

                return;
              }

              state.directBindingStarted=
                false;

              state.lastBinding={
                status:
                  'no-op-or-not-ready',

                attempt:
                  state.directBindingAttempts,

                module:
                  moduleName(),

                result:
                  result || null
              };

              if(
                state.directBindingAttempts>=3
              ){
                state.directBindingResolved=
                  true;

                state.lastBindingError=
                  'GENUINE_R1_BINDER_NOT_CONFIRMED_AFTER_3_ATTEMPTS';
              }
            },

            function(error){
              if(
                generation!==
                  state.generation
              ){
                return;
              }

              state.directBindingStarted=
                false;

              state.lastBindingError=
                error &&
                error.message
                  ? error.message
                  : String(error);

              state.lastBinding={
                status:
                  'rejected',

                attempt:
                  state.directBindingAttempts,

                module:
                  moduleName(),

                error:
                  state.lastBindingError
              };

              if(
                state.directBindingAttempts>=3
              ){
                state.directBindingResolved=
                  true;
              }
            }
          );
        }else{
          state.directBindingStarted=
            false;

          state.lastBinding={
            status:
              'unexpected-non-promise',

            attempt:
              state.directBindingAttempts,

            module:
              moduleName()
          };

          if(
            state.directBindingAttempts>=3
          ){
            state.directBindingResolved=
              true;

            state.lastBindingError=
              'GENUINE_R1_BINDER_NON_PROMISE_RESULT';
          }
        }
      }catch(error){
        state.directBindingStarted=
          false;

        state.lastBindingError=
          error &&
          error.message
            ? error.message
            : String(error);

        state.lastBinding={
          status:
            'exception',

          attempt:
            state.directBindingAttempts,

          module:
            moduleName(),

          error:
            state.lastBindingError
        };

        if(
          state.directBindingAttempts>=3
        ){
          state.directBindingResolved=
            true;
        }
      }
    }
  }



  if(
    frame===1 ||
    frame%
      PRESENT_EVERY===
      0
  ){
    cancelOlderLoops();

    coordinator(
      'settle-'+frame
    );

    (present(),stabilizePresentation());
  }

  var readiness=
    moduleReady();

  if(
    readiness.ready
  ){
    state.ready=
      true;

    state.readyFrame=
      frame;

    (present(),stabilizePresentation());

    state.raf=0;

    return;
  }

  if(
    frame>=
    MAX_SETTLE_FRAMES
  ){
    state.ready=
      false;

    state.readyFrame=
      null;

    (present(),stabilizePresentation());

    state.raf=0;

    return;
  }

  state.raf=
    requestAnimationFrame(
      function(){
        settle(
          generation,
          frame+1
        );
      }
    );
}

/* =======================================================
   ROUTE ENTRY
   ======================================================= */

var state=
  window
    .__AQUILA_FINANCE_R2_9_7_STATE__ ||
  {
    route:'',
    module:'',
    generation:0,
    routeEvents:0,
    raf:0,
    ready:false,
    readyFrame:null,
    lastEffects:null,
    lastPresentation:null,
    lastRouteReason:null,
    lastRouteAt:null
  };

window
  .__AQUILA_FINANCE_R2_9_7_STATE__=
  state;

function enterRoute(reason){
  var module=
    moduleName();

  if(!module){
    return;
  }

  var key=
    routeKey();

  if(
    state.route===key &&
    reason!=='manual' &&
    reason!=='runtime-load'
  ){
    return;
  }

  cancelOlderLoops();

  if(state.raf){
    cancelAnimationFrame(
      state.raf
    );

    state.raf=0;
  }

  state.route=
    key;

  state.module=
    module;

  state.generation++;

  state.routeEvents++;

  state.ready=false;

  state.readyFrame=null;

  state.directBindingStarted=false;
  state.directBindingResolved=false;
  state.directBindingAttempts=0;
  state.lastBinding=null;
  state.lastBindingError=null;



  state.lastRouteReason=
    reason;

  state.lastRouteAt=
    new Date()
      .toISOString();

  coordinator(
    'route-enter'
  );

  (present(),stabilizePresentation());

  var generation=
    state.generation;

  requestAnimationFrame(
    function(){

      if(
        generation!==
        state.generation
      ){
        return;
      }

      cancelOlderLoops();

      
      state.lastEffects={
        disabled:true,
        reason:'DIRECT_R1_BINDER_R2_9_9'
      };

      coordinator(
        'direct-binding-await-root'
      );

      settle(
        generation,
        1
      );
    }
  );
}

/* =======================================================
   ROUTE LISTENERS
   ======================================================= */

var previousPush=
  history.pushState;

if(
  !previousPush
    .__aquilaFinanceR297
){
  var pushState=
    function(){

      var result=
        previousPush.apply(
          this,
          arguments
        );

      enterRoute(
        'pushState'
      );

      return result;
    };

  pushState
    .__aquilaFinanceR297=
    true;

  pushState
    .__aquilaPrevious=
    previousPush;

  history.pushState=
    pushState;
}

var previousReplace=
  history.replaceState;

if(
  !previousReplace
    .__aquilaFinanceR297
){
  var replaceState=
    function(){

      var result=
        previousReplace.apply(
          this,
          arguments
        );

      enterRoute(
        'replaceState'
      );

      return result;
    };

  replaceState
    .__aquilaFinanceR297=
    true;

  replaceState
    .__aquilaPrevious=
    previousReplace;

  history.replaceState=
    replaceState;
}

window.addEventListener(
  'hashchange',
  function(){
    enterRoute(
      'hashchange'
    );
  }
);

window.addEventListener(
  'popstate',
  function(){
    enterRoute(
      'popstate'
    );
  }
);

/* =======================================================
   DIAGNOSTICS
   ======================================================= */

window
  .__AQUILA_FINANCE_R2_9_7__={
  version:
    VERSION,

  start:
    function(){
      enterRoute(
        'manual'
      );
    },

  present:
    present,

  replayDataEffects:
    replayDataEffects,

  diagnose:
    function(){

      return {
        version:
          VERSION,

        route:
          routeKey(),

        module:
          moduleName(),

        routeLifecycle:{
          generation:
            state.generation,

          routeEvents:
            state.routeEvents,

          rafActive:
            !!state.raf,

          ready:
            state.ready,

          readyFrame:
            state.readyFrame,

          lastRouteReason:
            state.lastRouteReason,

          lastRouteAt:
            state.lastRouteAt
        },

        reactEffectReplay:
          state.lastEffects,

        readiness:
          moduleReady(),

        presentation:
          state.lastPresentation,

        protectedClosed:{
          deckNeverBottom:
            true,

          scrollPreservation:
            true,

          overviewMonthly:
            true,

          recentTextVisible:
            true,

          recentStatusVisible:
            true
        }
      };
    }
};

cancelOlderLoops();

enterRoute(
  'runtime-load'
);



window.__AQUILA_FINANCE_R2_9_9__={
  version:
    'R2.9.9',

  architecture:
    'EXISTING_R1_BINDER_DIRECT_ROUTE_REBIND',

  diagnose:
    function(){
      var binder=null;

      try{
        if(
          window
            .__AQUILA_FINANCE_LIVE_DATA_R1__ &&
          typeof window
            .__AQUILA_FINANCE_LIVE_DATA_R1__
            .diagnose===
            'function'
        ){
          binder=
            window
              .__AQUILA_FINANCE_LIVE_DATA_R1__
              .diagnose();
        }
      }catch(error){
        binder={
          error:
            error &&
            error.message
              ? error.message
              : String(error)
        };
      }

      return {
        version:
          'R2.9.9',

        route:
          routeKey(),

        module:
          moduleName(),

        directBinding:{
          started:
            !!state.directBindingStarted,

          resolved:
            !!state.directBindingResolved,

          attempts:
            state.directBindingAttempts ||
            0,

          last:
            state.lastBinding,

          error:
            state.lastBindingError
        },

        genuineBinder:
          binder,

        effectReplayForDataLoading:
          false,

        ready:
          state.ready,

        readyFrame:
          state.readyFrame,

        presentation:
          state.lastPresentation
      };
    }
};



function stabilizePresentation(){
  var routeParams;

  try{
    routeParams=
      new URLSearchParams(
        String(
          location.hash ||
          ''
        ).replace(
          /^#/,
          ''
        )
      );
  }catch(_){
    routeParams=
      new URLSearchParams();
  }

  if(
    routeParams.get('section')!=='finance' &&
    !routeParams.get('finance')
  ){
    return null;
  }

  var pageX=
    window.scrollX;

  var pageY=
    window.scrollY;

  var scrollSnapshots=[];

  document
    .querySelectorAll(
      '.aquila-r297-chart-scroll,' +
      '.aquila-r295-chart-scroll,' +
      '.aquila-finance-chart-scroll,' +
      '.aquila-chart-scroll,' +
      '[data-aquila-r295-recent-scroll],' +
      '[data-aquila-r295-receivables-scroll]'
    )
    .forEach(
      function(element){
        scrollSnapshots.push({
          element:element,
          left:
            element.scrollLeft,
          top:
            element.scrollTop
        });
      }
    );

  var style=
    document.getElementById(
      'aquila-finance-r2-9-10-stability-style'
    );

  if(!style){
    style=
      document.createElement(
        'style'
      );

    style.id=
      'aquila-finance-r2-9-10-stability-style';

    style.textContent=
      [
        'html body .ubuzima-glass-workspace-dock,',
        'html body [data-ubuzima-workspace-dock]{',
        'position:fixed!important;',
        'top:10px!important;',
        'bottom:auto!important;',
        'left:50%!important;',
        'right:auto!important;',
        'transform:translateX(-50%)!important;',
        'margin:0!important;',
        'z-index:2147482000!important;',
        '}',
        '@media(max-width:767px){',
        'html body .ubuzima-glass-workspace-dock,',
        'html body [data-ubuzima-workspace-dock]{',
        'top:6px!important;',
        'bottom:auto!important;',
        '}',
        '}',
        '[data-aquila-r2910-chart="1"] ',
        '.recharts-cartesian-grid{',
        'display:none!important;',
        'opacity:0!important;',
        'visibility:hidden!important;',
        '}',
        '[data-aquila-r2910-chart="1"] ',
        '[data-aquila-value-label="1"] rect{',
        'fill:#000!important;',
        'stroke:#000!important;',
        '}',
        '[data-aquila-r2910-chart="1"] ',
        '[data-aquila-value-label="1"] text,',
        '[data-aquila-r2910-chart="1"] ',
        '[data-aquila-value-label="1"] tspan{',
        'fill:#fff!important;',
        'color:#fff!important;',
        '}',
        '[data-aquila-r2910-axis-hidden="1"]{',
        'display:none!important;',
        'visibility:hidden!important;',
        '}'
      ].join('');

    (
      document.head ||
      document.documentElement
    ).appendChild(
      style
    );
  }

  var mobile=false;

  try{
    mobile=
      !!(
        window.matchMedia &&
        window
          .matchMedia(
            '(max-width: 767px)'
          )
          .matches
      );
  }catch(_){}

  var deckTop=
    mobile
      ? '6px'
      : '10px';

  var deckCount=0;

  document
    .querySelectorAll(
      '.ubuzima-glass-workspace-dock,' +
      '[data-ubuzima-workspace-dock]'
    )
    .forEach(
      function(deck){
        deckCount++;

        deck.style.setProperty(
          'position',
          'fixed',
          'important'
        );

        deck.style.setProperty(
          'top',
          deckTop,
          'important'
        );

        deck.style.setProperty(
          'bottom',
          'auto',
          'important'
        );

        deck.style.setProperty(
          'left',
          '50%',
          'important'
        );

        deck.style.setProperty(
          'right',
          'auto',
          'important'
        );

        deck.style.setProperty(
          'transform',
          'translateX(-50%)',
          'important'
        );

        deck.style.setProperty(
          'margin',
          '0',
          'important'
        );

        deck.style.setProperty(
          'z-index',
          '2147482000',
          'important'
        );
      }
    );

  var titles=[
    'Revenue vs Expenses Trend',
    'Cash Flow Overview',
    'Income vs Expenses',
    'Net Profit Trend',
    'Cash Inflow vs Cash Outflow',
    'Net Cash Flow Trend',
    'Sales vs Returns',
    'Revenue Trend'
  ];

  function normalized(value){
    return String(
      value==null
        ? ''
        : value
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();
  }

  function visible(element){
    if(
      !element ||
      !element.isConnected
    ){
      return false;
    }

    var computed=
      getComputedStyle(
        element
      );

    var rect=
      element
        .getBoundingClientRect();

    return (
      computed.display!=='none' &&
      computed.visibility!=='hidden' &&
      computed.opacity!=='0' &&
      rect.width>0 &&
      rect.height>0
    );
  }

  function exactTitle(title){
    var nodes=
      document.querySelectorAll(
        'h1,h2,h3,h4,h5,h6,' +
        '[role="heading"],' +
        '.card-title,' +
        '.section-title,' +
        'div,span,p'
      );

    for(
      var index=0;
      index<nodes.length;
      index++
    ){
      if(
        visible(nodes[index]) &&
        normalized(
          nodes[index].textContent
        )===title
      ){
        return nodes[index];
      }
    }

    return null;
  }

  function chartCard(title){
    var heading=
      exactTitle(title);

    if(!heading){
      return null;
    }

    var element=
      heading;

    for(
      var depth=0;
      element &&
      depth<10;
      depth++,
      element=
        element.parentElement
    ){
      if(
        element.querySelector &&
        element.querySelector(
          '.recharts-wrapper,' +
          'svg,' +
          'canvas'
        )
      ){
        return element;
      }
    }

    return null;
  }

  var datePattern=
    /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{1,2})?(?:,?\s+\d{4})?|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/i;

  function dateLike(value){
    return datePattern.test(
      normalized(value)
    );
  }

  function restoreOwnedAxis(axis){
    if(
      axis &&
      axis.getAttribute(
        'data-aquila-r2910-axis-hidden'
      )==='1'
    ){
      axis.removeAttribute(
        'data-aquila-r2910-axis-hidden'
      );

      axis.style.removeProperty(
        'display'
      );

      axis.style.removeProperty(
        'visibility'
      );
    }
  }

  function hideAxis(axis){
    if(!axis){
      return;
    }

    axis.setAttribute(
      'data-aquila-r2910-axis-hidden',
      '1'
    );

    axis.style.setProperty(
      'display',
      'none',
      'important'
    );

    axis.style.setProperty(
      'visibility',
      'hidden',
      'important'
    );
  }

  function dateTexts(axis){
    var values=[];

    if(!axis){
      return values;
    }

    axis
      .querySelectorAll(
        'text,tspan,span'
      )
      .forEach(
        function(node){
          var value=
            normalized(
              node.textContent
            );

          if(
            value &&
            dateLike(value) &&
            values.indexOf(
              value
            )<0
          ){
            values.push(
              value
            );
          }
        }
      );

    if(
      values.length===0
    ){
      var whole=
        normalized(
          axis.textContent
        );

      if(
        whole &&
        dateLike(whole)
      ){
        values.push(
          whole
        );
      }
    }

    return values;
  }

  function axisScore(axis){
    var dates=
      dateTexts(axis);

    var visibleLabels=0;

    axis
      .querySelectorAll(
        'text,tspan,span'
      )
      .forEach(
        function(node){
          if(
            visible(node) &&
            dateLike(
              node.textContent
            )
          ){
            visibleLabels++;
          }
        }
      );

    return (
      dates.length*100 +
      visibleLabels*10 +
      Math.min(
        50,
        normalized(
          axis.textContent
        ).length
      )
    );
  }

  function nativeAxes(card){
    return Array.prototype
      .filter.call(
        card.querySelectorAll(
          '.recharts-xAxis'
        ),
        function(axis){
          return (
            dateTexts(axis).length>0
          );
        }
      );
  }

  function generatedAxes(card){
    var selector=
      '.aquila-finance-axis,' +
      '.aquila-axis,' +
      '.aquila-r297-axis,' +
      '.aquila-r295-axis,' +
      '.aquila-r291-axis,' +
      '[data-aquila-axis],' +
      '[class^="aquila-"][class*="axis"],' +
      '[class*=" aquila-"][class*="axis"]';

    var raw=
      Array.prototype
        .filter.call(
          card.querySelectorAll(
            selector
          ),
          function(element){
            if(
              element.classList &&
              element.classList.contains(
                'recharts-xAxis'
              )
            ){
              return false;
            }

            if(
              element.closest &&
              element.closest(
                '.recharts-xAxis'
              )
            ){
              return false;
            }

            if(
              element.querySelector &&
              element.querySelector(
                '.recharts-xAxis'
              )
            ){
              return false;
            }

            return (
              dateTexts(
                element
              ).length>0
            );
          }
        );

    return raw.filter(
      function(element,index,array){
        for(
          var position=0;
          position<array.length;
          position++
        ){
          if(
            position!==index &&
            array[position]
              .contains(
                element
              )
          ){
            return false;
          }
        }

        return true;
      }
    );
  }

  var cardsFound=0;
  var gridsHidden=0;
  var axesHidden=0;
  var nativeAxisOwners=0;
  var generatedAxisOwners=0;
  var labelNodesReinforced=0;

  titles.forEach(
    function(title){
      var card=
        chartCard(title);

      if(!card){
        return;
      }

      cardsFound++;

      card.setAttribute(
        'data-aquila-r2910-chart',
        '1'
      );

      card
        .querySelectorAll(
          '.recharts-cartesian-grid'
        )
        .forEach(
          function(grid){
            gridsHidden++;

            grid.style.setProperty(
              'display',
              'none',
              'important'
            );

            grid.style.setProperty(
              'opacity',
              '0',
              'important'
            );

            grid.style.setProperty(
              'visibility',
              'hidden',
              'important'
            );
          }
        );

      card
        .querySelectorAll(
          '[data-aquila-value-label="1"]'
        )
        .forEach(
          function(label){
            labelNodesReinforced++;

            label.style &&
              label.style.setProperty(
                'color',
                '#fff',
                'important'
              );

            label.style &&
              label.style.setProperty(
                'background',
                '#000',
                'important'
              );

            if(
              label.matches &&
              label.matches(
                'text,tspan'
              )
            ){
              label.setAttribute(
                'fill',
                '#fff'
              );
            }

            if(
              label.matches &&
              label.matches(
                'rect'
              )
            ){
              label.setAttribute(
                'fill',
                '#000'
              );

              label.setAttribute(
                'stroke',
                '#000'
              );
            }

            if(
              label.querySelectorAll
            ){
              label
                .querySelectorAll(
                  'rect'
                )
                .forEach(
                  function(rect){
                    rect.setAttribute(
                      'fill',
                      '#000'
                    );

                    rect.setAttribute(
                      'stroke',
                      '#000'
                    );
                  }
                );

              label
                .querySelectorAll(
                  'text,tspan'
                )
                .forEach(
                  function(textNode){
                    textNode.setAttribute(
                      'fill',
                      '#fff'
                    );

                    textNode.style &&
                      textNode.style.setProperty(
                        'color',
                        '#fff',
                        'important'
                      );
                  }
                );
            }
          }
        );

      var allPotentialAxes=
        card.querySelectorAll(
          '.recharts-xAxis,' +
          '.aquila-finance-axis,' +
          '.aquila-axis,' +
          '.aquila-r297-axis,' +
          '.aquila-r295-axis,' +
          '.aquila-r291-axis,' +
          '[data-aquila-axis]'
        );

      Array.prototype
        .forEach.call(
          allPotentialAxes,
          restoreOwnedAxis
        );

      var native=
        nativeAxes(card);

      var generated=
        generatedAxes(card);

      if(
        native.length>0
      ){
        native.sort(
          function(left,right){
            return (
              axisScore(right) -
              axisScore(left)
            );
          }
        );

        nativeAxisOwners++;

        native
          .slice(1)
          .forEach(
            function(axis){
              hideAxis(axis);
              axesHidden++;
            }
          );

        generated.forEach(
          function(axis){
            hideAxis(axis);
            axesHidden++;
          }
        );

        return;
      }

      if(
        generated.length>0
      ){
        generated.sort(
          function(left,right){
            return (
              axisScore(right) -
              axisScore(left)
            );
          }
        );

        generatedAxisOwners++;

        generated
          .slice(1)
          .forEach(
            function(axis){
              hideAxis(axis);
              axesHidden++;
            }
          );
      }
    }
  );

  scrollSnapshots.forEach(
    function(snapshot){
      if(
        snapshot.element &&
        snapshot.element.isConnected
      ){
        snapshot.element.scrollLeft=
          snapshot.left;

        snapshot.element.scrollTop=
          snapshot.top;
      }
    }
  );

  if(
    window.scrollX!==pageX ||
    window.scrollY!==pageY
  ){
    window.scrollTo(
      pageX,
      pageY
    );
  }

  state.r2910LastStability={
    version:'R2.9.10',
    at:
      new Date()
        .toISOString(),
    module:
      routeParams.get('finance') ||
      'overview',
    deckCount:
      deckCount,
    deckTop:
      deckTop,
    deckBottom:
      'auto',
    chartCardsFound:
      cardsFound,
    gridsHidden:
      gridsHidden,
    axesHidden:
      axesHidden,
    nativeAxisOwners:
      nativeAxisOwners,
    generatedAxisOwners:
      generatedAxisOwners,
    labelNodesReinforced:
      labelNodesReinforced
  };

  return state.r2910LastStability;
}

window.__AQUILA_FINANCE_R2_9_10__={
  version:'R2.9.10',

  architecture:
    'SPECIALIZED_MODULE_OWNERS_EXISTING_BOUNDED_SETTLE',

  stabilize:
    stabilizePresentation,

  diagnose:function(){
    var overview=null;
    var binder=null;
    var presenter=null;

    try{
      if(
        window
          .__AQUILA_FINANCE_OVERVIEW_R2_9_10__ &&
        typeof window
          .__AQUILA_FINANCE_OVERVIEW_R2_9_10__
          .diagnose==='function'
      ){
        overview=
          window
            .__AQUILA_FINANCE_OVERVIEW_R2_9_10__
            .diagnose();
      }
    }catch(error){
      overview={
        error:
          error &&
          error.message
            ? error.message
            : String(error)
      };
    }

    try{
      if(
        window
          .__AQUILA_FINANCE_LIVE_DATA_R1__ &&
        typeof window
          .__AQUILA_FINANCE_LIVE_DATA_R1__
          .diagnose==='function'
      ){
        binder=
          window
            .__AQUILA_FINANCE_LIVE_DATA_R1__
            .diagnose();
      }
    }catch(error){
      binder={
        error:
          error &&
          error.message
            ? error.message
            : String(error)
      };
    }

    try{
      if(
        window
          .__AQUILA_FINANCE_R2_9_1__ &&
        typeof window
          .__AQUILA_FINANCE_R2_9_1__
          .diagnose==='function'
      ){
        presenter=
          window
            .__AQUILA_FINANCE_R2_9_1__
            .diagnose();
      }
    }catch(error){
      presenter={
        error:
          error &&
          error.message
            ? error.message
            : String(error)
      };
    }

    return {
      version:'R2.9.10',

      route:
        routeKey(),

      module:
        moduleName(),

      moduleOwners:{
        overview:
          'existing-specialized-loadOverview',
        profitLoss:
          'existing-bindPnl',
        cashFlow:
          'existing-bindCashFlow',
        sales:
          'existing-R1-plus-R2.9.1-applySales'
      },

      salesReturnsPolicy:
        'genuine-refund-return-map-only',

      paidAmountUsedAsReturn:
        false,

      deckOwner:
        'static-top-center',

      dateAxisOwner:
        'one-native-else-one-generated',

      effectReplayForDataLoading:
        false,

      stability:
        state.r2910LastStability ||
        null,

      overview:
        overview,

      binder:
        binder,

      presenter:
        presenter
    };
  }
};

stabilizePresentation();

})();


/* ==========================================================
   UBUZIMA+ FINANCE R2.9.12
   Manual genuine-data refresh + presentation completion.

   This layer does NOT:
   - own Finance data
   - create Finance values
   - create dates
   - replay React effects
   - remount React
   - create route listeners
   - create observers
   - create polling/timers
   - reload the browser
   ========================================================== */
(function () {
  'use strict';

  if (
    window.__AQUILA_FINANCE_R2_9_12__
  ) {
    return;
  }

  var VERSION = 'R2.9.12';

  var CHARTS = [
    {
      title:
        'Revenue vs Expenses Trend',
      granularity:
        'monthly'
    },
    {
      title:
        'Cash Flow Overview',
      granularity:
        'monthly'
    },
    {
      title:
        'Income vs Expenses',
      granularity:
        'daily'
    },
    {
      title:
        'Net Profit Trend',
      granularity:
        'daily'
    },
    {
      title:
        'Cash Inflow vs Cash Outflow',
      granularity:
        'daily'
    },
    {
      title:
        'Net Cash Flow Trend',
      granularity:
        'daily'
    },
    {
      title:
        'Sales vs Returns',
      granularity:
        'daily'
    },
    {
      title:
        'Revenue Trend',
      granularity:
        'daily'
    }
  ];

  var state = {
    presentationRuns: 0,
    manualRefreshes: 0,
    lastRefreshAt: null,
    lastRefreshModule: null,
    lastRefreshResult: null,
    lastError: null,
    lastPresentationAt: null
  };

  var nativeApply = null;

  function norm(value) {
    return String(
      value == null
        ? ''
        : value
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();
  }

  function visible(el) {
    if (
      !el
      ||
      !el.isConnected
    ) {
      return false;
    }

    var style =
      getComputedStyle(el);

    var rect =
      el.getBoundingClientRect();

    return (
      style.display !== 'none'
      &&
      style.visibility !== 'hidden'
      &&
      rect.width > 0
      &&
      rect.height > 0
    );
  }

  function financeModule() {
    var params;

    try {
      params =
        new URLSearchParams(
          String(
            location.hash
            || ''
          ).replace(
            /^#/,
            ''
          )
        );
    } catch (_) {
      return '';
    }

    if (
      params.get('section')
        !== 'finance'
      &&
      !params.get('finance')
    ) {
      return '';
    }

    return (
      params.get('finance')
      || 'overview'
    );
  }

  function exactNode(text) {
    var nodes =
      document.querySelectorAll(
        'h1,h2,h3,h4,h5,h6,'
        + '[role="heading"],'
        + '.card-title,'
        + '.section-title,'
        + 'div,span,p'
      );

    for (
      var i = 0;
      i < nodes.length;
      i += 1
    ) {
      if (
        visible(nodes[i])
        &&
        norm(
          nodes[i].textContent
        ) === text
      ) {
        return nodes[i];
      }
    }

    return null;
  }

  function cardFor(title) {
    var heading =
      exactNode(title);

    if (!heading) {
      return null;
    }

    var el = heading;

    for (
      var depth = 0;
      el && depth < 10;
      depth += 1,
      el = el.parentElement
    ) {
      if (
        el.querySelector
        &&
        el.querySelector(
          'svg,canvas,table'
        )
      ) {
        return el;
      }
    }

    return heading.parentElement;
  }

  function captureScroll() {
    var selectors = [
      '.aquila-finance-chart-scroll',
      '.aquila-chart-scroll',
      '[data-aquila-r295-recent-scroll]',
      '[data-aquila-r295-receivables]',
      '.system-table-wrap',
      '.table-responsive'
    ];

    var seen = [];
    var nodes = [];

    selectors.forEach(
      function (selector) {
        document
          .querySelectorAll(
            selector
          )
          .forEach(
            function (el) {
              if (
                seen.indexOf(el)
                  >= 0
              ) {
                return;
              }

              seen.push(el);

              nodes.push({
                el: el,
                left:
                  el.scrollLeft,
                top:
                  el.scrollTop
              });
            }
          );
      }
    );

    return {
      x:
        window.scrollX,
      y:
        window.scrollY,
      nodes:
        nodes
    };
  }

  function restoreScroll(saved) {
    if (!saved) {
      return;
    }

    saved.nodes.forEach(
      function (entry) {
        if (
          entry.el
          &&
          entry.el.isConnected
        ) {
          entry.el.scrollLeft =
            entry.left;

          entry.el.scrollTop =
            entry.top;
        }
      }
    );

    if (
      window.scrollX
        !== saved.x
      ||
      window.scrollY
        !== saved.y
    ) {
      window.scrollTo(
        saved.x,
        saved.y
      );
    }
  }

  function generatedAxes(card) {
    if (!card) {
      return [];
    }

    var all =
      Array.prototype.slice.call(
        card.querySelectorAll(
          '.aquila-finance-axis-strip,'
          + '.aquila-finance-axis,'
          + '.aquila-axis,'
          + '[data-aquila-axis],'
          + '[data-aquila-generated-axis]'
        )
      );

    return all.filter(
      function (el) {
        return !all.some(
          function (other) {
            return (
              other !== el
              &&
              other.contains(el)
            );
          }
        );
      }
    );
  }

  function nativeXAxis(card) {
    if (!card) {
      return [];
    }

    return Array.prototype
      .slice.call(
        card.querySelectorAll(
          '.recharts-xAxis '
          + '.recharts-cartesian-axis-tick-value,'
          + '.recharts-xAxis text'
        )
      )
      .filter(visible);
  }

  function normalizeOneChart(spec) {
    var card =
      cardFor(spec.title);

    if (!card) {
      return {
        title:
          spec.title,
        found:
          false
      };
    }

    card.setAttribute(
      'data-aquila-r2912-chart',
      spec.granularity
    );

    card
      .querySelectorAll(
        '.recharts-cartesian-grid'
      )
      .forEach(
        function (grid) {
          grid.style.setProperty(
            'display',
            'none',
            'important'
          );

          grid.style.setProperty(
            'opacity',
            '0',
            'important'
          );
        }
      );

    card
      .querySelectorAll(
        '.recharts-xAxis text,'
        + '.recharts-xAxis '
        + '.recharts-cartesian-axis-tick-value'
      )
      .forEach(
        function (tick) {
          tick.style.setProperty(
            'display',
            'block',
            'important'
          );

          tick.style.setProperty(
            'visibility',
            'visible',
            'important'
          );

          tick.style.setProperty(
            'opacity',
            '1',
            'important'
          );
        }
      );

    var labels =
      Array.prototype.slice.call(
        card.querySelectorAll(
          '[data-aquila-value-label="1"],'
          + '[data-aquila-finance-data-label]'
        )
      );

    labels.forEach(
      function (label) {
        if (label.style) {
          label.style.setProperty(
            'background',
            '#000',
            'important'
          );

          label.style.setProperty(
            'background-color',
            '#000',
            'important'
          );

          label.style.setProperty(
            'color',
            '#fff',
            'important'
          );

          label.style.setProperty(
            'fill',
            '#fff',
            'important'
          );
        }

        label
          .querySelectorAll(
            'rect'
          )
          .forEach(
            function (rect) {
              rect.setAttribute(
                'fill',
                '#000'
              );

              rect.style.setProperty(
                'fill',
                '#000',
                'important'
              );
            }
          );

        label
          .querySelectorAll(
            'text,tspan'
          )
          .forEach(
            function (text) {
              text.setAttribute(
                'fill',
                '#fff'
              );

              text.style.setProperty(
                'fill',
                '#fff',
                'important'
              );

              text.style.setProperty(
                'color',
                '#fff',
                'important'
              );
            }
          );
      }
    );

    var nativeDates =
      nativeXAxis(card);

    var generated =
      generatedAxes(card);

    if (
      nativeDates.length > 0
    ) {
      generated.forEach(
        function (axis) {
          axis.style.setProperty(
            'display',
            'none',
            'important'
          );
        }
      );
    } else if (
      generated.length > 0
    ) {
      var keeper =
        generated
          .slice()
          .sort(
            function (a, b) {
              var ac =
                a.querySelectorAll(
                  'span,text'
                ).length;

              var bc =
                b.querySelectorAll(
                  'span,text'
                ).length;

              return bc - ac;
            }
          )[0];

      generated.forEach(
        function (axis) {
          if (
            axis === keeper
          ) {
            axis.style.removeProperty(
              'display'
            );

            axis.style.removeProperty(
              'visibility'
            );

            axis.style.removeProperty(
              'opacity'
            );
          } else {
            axis.style.setProperty(
              'display',
              'none',
              'important'
            );
          }
        }
      );
    }

    card
      .querySelectorAll(
        '.aquila-finance-chart-scroll,'
        + '.aquila-chart-scroll,'
        + '[data-aquila-chart-scroll]'
      )
      .forEach(
        function (scroll) {
          scroll.style.setProperty(
            'overflow-x',
            'auto',
            'important'
          );
        }
      );

    return {
      title:
        spec.title,
      found:
        true,
      granularity:
        spec.granularity,
      dataLabels:
        labels.length,
      nativeXAxisLabels:
        nativeXAxis(card).length,
      generatedAxisOwners:
        generatedAxes(card)
          .filter(visible)
          .length,
      gridVisible:
        Array.prototype.some.call(
          card.querySelectorAll(
            '.recharts-cartesian-grid'
          ),
          visible
        )
    };
  }

  function tableCard(names) {
    for (
      var i = 0;
      i < names.length;
      i += 1
    ) {
      var card =
        cardFor(
          names[i]
        );

      if (
        card
        &&
        card.querySelector(
          'table'
        )
      ) {
        return card;
      }
    }

    return null;
  }

  function fiveRows(table) {
    if (!table) {
      return false;
    }

    var rows =
      table.querySelectorAll(
        'tbody tr'
      );

    if (
      rows.length <= 5
    ) {
      return false;
    }

    var parent =
      table.parentElement;

    if (!parent) {
      return false;
    }

    var head =
      table.querySelector(
        'thead'
      );

    var headHeight =
      head
        ? head
            .getBoundingClientRect()
            .height
        : 0;

    var rowHeight = 0;

    for (
      var i = 0;
      i < Math.min(
        5,
        rows.length
      );
      i += 1
    ) {
      rowHeight +=
        rows[i]
          .getBoundingClientRect()
          .height;
    }

    if (
      rowHeight > 0
    ) {
      parent.style.setProperty(
        'max-height',
        Math.ceil(
          headHeight
          + rowHeight
          + 4
        ) + 'px',
        'important'
      );

      parent.style.setProperty(
        'overflow-y',
        'auto',
        'important'
      );

      parent.style.setProperty(
        'overflow-x',
        'auto',
        'important'
      );

      return true;
    }

    return false;
  }

  function normalizeRecent() {
    var card =
      tableCard([
        'Recent Transactions',
        'Recent Sales Transactions',
        'Recent Sales Transaction'
      ]);

    if (!card) {
      return {
        found:
          false
      };
    }

    var table =
      card.querySelector(
        'table'
      );

    if (!table) {
      return {
        found:
          false
      };
    }

    table
      .querySelectorAll(
        'th,td'
      )
      .forEach(
        function (cell) {
          cell.style.setProperty(
            'white-space',
            'nowrap',
            'important'
          );

          cell.style.setProperty(
            'text-overflow',
            'clip',
            'important'
          );

          var value =
            norm(
              cell.textContent
            );

          if (value) {
            cell.title =
              value;
          }
        }
      );

    var headers =
      Array.prototype
        .slice.call(
          table.querySelectorAll(
            'thead th'
          )
        )
        .map(
          function (header) {
            return norm(
              header.textContent
            );
          }
        );

    var descriptionIndex =
      headers.findIndex(
        function (header) {
          return /description/i
            .test(header);
        }
      );

    if (
      descriptionIndex >= 0
    ) {
      table
        .querySelectorAll(
          'tr'
        )
        .forEach(
          function (row) {
            var cells =
              row.children;

            if (
              cells[
                descriptionIndex
              ]
            ) {
              cells[
                descriptionIndex
              ].style.setProperty(
                'min-width',
                '260px',
                'important'
              );
            }
          }
        );
    }

    return {
      found:
        true,
      headers:
        headers,
      rows:
        table.querySelectorAll(
          'tbody tr'
        ).length,
      fiveRowScroll:
        fiveRows(table),
      statusVisible:
        headers.some(
          function (header) {
            return /^status$/i
              .test(header);
          }
        )
    };
  }

  function normalizeReceivables() {
    var card =
      tableCard([
        'Top Receivables'
      ]);

    if (!card) {
      return {
        found:
          false
      };
    }

    var table =
      card.querySelector(
        'table'
      );

    if (!table) {
      return {
        found:
          false
      };
    }

    var headers =
      Array.prototype
        .slice.call(
          table.querySelectorAll(
            'thead th'
          )
        );

    if (
      headers.length === 4
    ) {
      var names = [
        'Insurer',
        'Customer',
        'Outstanding',
        'Ageing (Days)'
      ];

      headers.forEach(
        function (header, index) {
          header.textContent =
            names[index];

          header.style.setProperty(
            'white-space',
            'nowrap',
            'important'
          );
        }
      );
    }

    return {
      found:
        true,
      columns:
        headers.map(
          function (header) {
            return norm(
              header.textContent
            );
          }
        ),
      rows:
        table.querySelectorAll(
          'tbody tr'
        ).length,
      fiveRowScroll:
        fiveRows(table)
    };
  }

  function normalizePresentation() {
    return {
      charts:
        CHARTS.map(
          normalizeOneChart
        ),
      recentTransactions:
        normalizeRecent(),
      topReceivables:
        normalizeReceivables()
    };
  }

  function runPresentation() {
    if (!financeModule()) {
      return null;
    }

    var saved =
      captureScroll();

    try {
      var presentation =
        window
          .__AQUILA_FINANCE_BROWSER_REMEDIATION__;

      if (
        presentation
        &&
        typeof presentation
          .applyPresentation
          === 'function'
      ) {
        presentation
          .applyPresentation();
      }
    } catch (_) {}

    try {
      var recent =
        window
          .__AQUILA_FINANCE_R2_9_4__;

      if (
        recent
        &&
        typeof recent
          .applyRecentLayout
          === 'function'
      ) {
        recent
          .applyRecentLayout();
      }
    } catch (_) {}

    try {
      var r295 =
        window
          .__AQUILA_FINANCE_R2_9_5__;

      if (
        r295
        &&
        typeof r295.present
          === 'function'
      ) {
        r295.present();
      }
    } catch (_) {}

    var result =
      normalizePresentation();

    ensureRefreshButton();

    restoreScroll(saved);

    state.presentationRuns += 1;

    state.lastPresentationAt =
      new Date()
        .toISOString();

    return result;
  }

  function exactInteractive(text) {
    var nodes =
      document.querySelectorAll(
        'button,a,[role="button"]'
      );

    for (
      var i = 0;
      i < nodes.length;
      i += 1
    ) {
      if (
        visible(nodes[i])
        &&
        norm(
          nodes[i].textContent
        ) === text
      ) {
        return nodes[i];
      }
    }

    return null;
  }

  function findActionHost(main) {
    if (!main) {
      return null;
    }

    var node =
      main.parentElement;

    for (
      var depth = 0;
      node && depth < 6;
      depth += 1,
      node = node.parentElement
    ) {
      var controls =
        node.querySelectorAll(
          'button,a,[role="button"]'
        );

      var hasBack =
        Array.prototype.some.call(
          controls,
          function (control) {
            return (
              visible(control)
              &&
              /^back\b/i.test(
                norm(
                  control.textContent
                )
              )
            );
          }
        );

      if (hasBack) {
        return node;
      }
    }

    return main.parentElement;
  }

  function clearFinanceCaches() {
    var results = {
      r1: false,
      dataCoordinator: false,
      workspace: false
    };

    try {
      var live =
        window
          .__AQUILA_FINANCE_LIVE_DATA_R1__;

      if (
        live
        &&
        typeof live.invalidateCache
          === 'function'
      ) {
        results.r1 =
          live.invalidateCache()
          === true;
      }
    } catch (_) {}

    try {
      var r295 =
        window
          .__AQUILA_FINANCE_R2_9_5__;

      if (
        r295
        &&
        typeof r295
          .invalidateFinanceCache
          === 'function'
      ) {
        r295
          .invalidateFinanceCache(
            'r2.9.12-manual-refresh'
          );

        results.dataCoordinator =
          true;
      }
    } catch (_) {}

    try {
      var workspace =
        window
          .__AQUILA_FINANCE_WORKSPACE_CACHE__;

      if (
        workspace
        &&
        typeof workspace
          .invalidateAll
          === 'function'
      ) {
        results.workspace =
          workspace.invalidateAll()
          === true;
      } else if (
        workspace
        &&
        typeof workspace.invalidate
          === 'function'
      ) {
        workspace.invalidate();

        results.workspace =
          true;
      }
    } catch (_) {}

    return results;
  }

  async function manualRefresh(button) {
    var module =
      financeModule();

    if (!module) {
      return false;
    }

    var saved =
      captureScroll();

    state.manualRefreshes += 1;

    state.lastRefreshModule =
      module;

    state.lastRefreshAt =
      new Date()
        .toISOString();

    state.lastError =
      null;

    if (button) {
      button.disabled =
        true;

      button.setAttribute(
        'aria-busy',
        'true'
      );

      button.textContent =
        'Refreshing…';
    }

    try {
      var invalidation =
        clearFinanceCaches();

      var result;

      if (
        module === 'overview'
      ) {
        var overview =
          window
            .__AQUILA_FINANCE_CACHE_OVERVIEW_R1_2_R2__;

        if (
          !overview
          ||
          typeof overview.refresh
            !== 'function'
        ) {
          throw new Error(
            'OVERVIEW_REFRESH_OWNER_UNAVAILABLE'
          );
        }

        result =
          await overview.refresh();
      } else {
        var live =
          window
            .__AQUILA_FINANCE_LIVE_DATA_R1__;

        if (
          !live
          ||
          typeof nativeApply
            !== 'function'
        ) {
          throw new Error(
            'ACTIVE_MODULE_OWNER_UNAVAILABLE'
          );
        }

        result =
          nativeApply.call(
            live,
            'r2.9.12-manual-refresh'
          );

        result =
          await Promise.resolve(
            result
          );

        if (
          result === false
        ) {
          throw new Error(
            'ACTIVE_MODULE_ROOT_NOT_READY'
          );
        }
      }

      runPresentation();

      restoreScroll(saved);

      state.lastRefreshResult = {
        ok: true,
        module:
          module,
        invalidation:
          invalidation
      };

      return true;

    } catch (error) {
      state.lastError =
        error
        &&
        error.message
          ? error.message
          : String(error);

      state.lastRefreshResult = {
        ok: false,
        module:
          module,
        error:
          state.lastError
      };

      restoreScroll(saved);

      return false;

    } finally {
      if (
        button
        &&
        button.isConnected
      ) {
        button.disabled =
          false;

        button.removeAttribute(
          'aria-busy'
        );

        button.textContent =
          'Refresh';
      }

      ensureRefreshButton();
    }
  };window.__AQUILA_FINANCE_NATIVE_REFRESH_R1__=Object.freeze({refresh:manualRefresh});

  function ensureRefreshButton() {/*AQUILA_FINANCE_NATIVE_REFRESH_R1_DOM_OWNER_RETIRED*/return null;
    if (!financeModule()) {
      return null;
    }

    var existing =
      document.querySelector(
        '[data-aquila-finance-refresh-r2912="1"]'
      );

    if (
      existing
      &&
      existing.isConnected
    ) {
      return existing;
    }

    var main =
      exactInteractive(
        'Main Dashboard'
      );

    if (!main) {
      return null;
    }

    var host =
      findActionHost(main);

    if (!host) {
      return null;
    }

    var button =
      document.createElement(
        'button'
      );

    button.type =
      'button';

    button.className =
      main.className || '';

    button.textContent =
      'Refresh';

    button.title =
      'Reload current Finance data';

    button.setAttribute(
      'data-aquila-finance-refresh-r2912',
      '1'
    );

    button.setAttribute(
      'aria-label',
      'Refresh current Finance data'
    );

    button.onclick =
      function () {
        manualRefresh(
          button
        );
      };

    if (
      main.nextSibling
    ) {
      host.insertBefore(
        button,
        main.nextSibling
      );
    } else {
      host.appendChild(
        button
      );
    }

    return button;
  }

  var live =
    window
      .__AQUILA_FINANCE_LIVE_DATA_R1__;

  if (
    live
    &&
    typeof live.applyActiveModule
      === 'function'
  ) {
    nativeApply =
      live.applyActiveModule;

    if (
      !nativeApply
        .__aquilaFinanceR2912
    ) {
      var wrapped =
        function () {
          var result =
            nativeApply.apply(
              this,
              arguments
            );

          if (
            result
            &&
            typeof result.then
              === 'function'
          ) {
            return result.then(
              function (value) {
                if (
                  value !== false
                ) {
                  runPresentation();
                }

                return value;
              }
            );
          }

          if (
            result !== false
          ) {
            runPresentation();
          }

          return result;
        };

      wrapped
        .__aquilaFinanceR2912 =
        true;

      wrapped
        .__aquilaPrevious =
        nativeApply;

      live.applyActiveModule =
        wrapped;
    }
  }

  window
    .__AQUILA_FINANCE_R2_9_12__ = {
      version:
        VERSION,

      refresh:
        function () {
          return manualRefresh(
            document.querySelector(
              '[data-aquila-finance-refresh-r2912="1"]'
            )
          );
        },

      applyPresentation:
        runPresentation,

      diagnose:
        function () {
          return {
            version:
              VERSION,

            module:
              financeModule(),

            refreshButton:
              !!document.querySelector(
                '[data-aquila-finance-refresh-r2912="1"]'
              ),

            state:
              Object.assign(
                {},
                state
              ),

            charts:
              CHARTS.map(
                normalizeOneChart
              ),

            recentTransactions:
              normalizeRecent(),

            topReceivables:
              normalizeReceivables()
          };
        }
    };

  if (
    financeModule()
  ) {
    runPresentation();
  }

}());


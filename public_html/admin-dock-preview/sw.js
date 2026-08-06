const CACHE_NAME = 'ubuzima-admin-shell-v22';
const FAILOVER_CACHE_NAME = 'ubuzima-admin-failover-v1';
const SAFE_LANDING_PATH = '/admin/pwa-safe.html';
const SHELL_ASSETS = [
  '/admin/',
  '/admin/index.html',
  SAFE_LANDING_PATH,
  '/admin/manifest.webmanifest',
  '/admin/assets/ubuzima-pwa-icon.svg',
  '/admin/assets/ubuzima-pwa-maskable.svg',
  '/admin/assets/ubuzima-logo.png',
  '/admin/assets/vitapharma-logo.png'
];
const STATIC_SEED_ASSETS = SHELL_ASSETS.filter((assetPath) => !assetPath.endsWith('/') && !assetPath.endsWith('.html'));

function isHtmlResponse(response) {
  return (response.headers.get('content-type') || '').includes('text/html');
}

function isCacheableAssetResponse(response) {
  return response.ok && !isHtmlResponse(response);
}

function isAdminShellHtml(html) {
  return html.includes('ubuzima-boot-fallback') && (
    html.includes('/admin/assets/') ||
    html.includes('/src/main.tsx')
  );
}

function isSafeLandingHtml(html) {
  return html.includes('ubuzima-safe-landing') && html.includes('openStableApp');
}

function extractAdminAssetPaths(html) {
  const matches = html.match(/\/admin\/assets\/[^"'<>\\s]+/g) || [];
  return Array.from(new Set(matches));
}

async function cacheResponse(cache, request, response) {
  if (isCacheableAssetResponse(response)) {
    await cache.put(request, response.clone());
  }
}

async function cacheDiscoveredShellAssets(cache, html) {
  const assetPaths = extractAdminAssetPaths(html);

  await Promise.allSettled(
    assetPaths.map(async (assetPath) => {
      const response = await fetch(assetPath, { cache: 'reload' });
      await cacheResponse(cache, assetPath, response);
    })
  );
}

async function cacheSeedAssets(cache) {
  await Promise.allSettled(
    STATIC_SEED_ASSETS.map(async (assetPath) => {
      const response = await fetch(assetPath, { cache: 'reload' });
      await cacheResponse(cache, assetPath, response);
    })
  );

  await cacheSafeLanding(cache).catch(() => {});
}

async function cachedAdminShell(cache) {
  const cached = await cache.match('/admin/index.html');

  if (!cached || !cached.ok || !isHtmlResponse(cached)) {
    return undefined;
  }

  const html = await cached.clone().text();

  if (isAdminShellHtml(html)) {
    return cached;
  }

  await cache.delete('/admin/index.html');
  await cache.delete('/admin/');

  return undefined;
}

async function cacheSafeLanding(cache) {
  const response = await fetch(SAFE_LANDING_PATH, { cache: 'reload' });

  if (response.ok && isHtmlResponse(response)) {
    const html = await response.clone().text();

    if (isSafeLandingHtml(html)) {
      await cache.put(SAFE_LANDING_PATH, response.clone());
    }
  }
}

async function cachedSafeLanding(cache) {
  const cached = await cache.match(SAFE_LANDING_PATH);

  if (!cached || !cached.ok || !isHtmlResponse(cached)) {
    return undefined;
  }

  const html = await cached.clone().text();

  return isSafeLandingHtml(html) ? cached : undefined;
}

async function safeLandingResponse(reason) {
  const cache = await caches.open(CACHE_NAME);
  const failoverCache = await caches.open(FAILOVER_CACHE_NAME);
  const cached = await cachedSafeLanding(cache) || await cachedSafeLanding(failoverCache);

  return cached || shellRecoveryResponse(reason);
}

async function promoteFailoverSnapshot() {
  const cache = await caches.open(CACHE_NAME);
  const failoverCache = await caches.open(FAILOVER_CACHE_NAME);
  const shell = await cachedAdminShell(cache);

  if (!shell) {
    return;
  }

  const html = await shell.clone().text();
  await failoverCache.put('/admin/index.html', shell.clone());
  await failoverCache.put('/admin/', shell.clone());
  await cacheDiscoveredShellAssets(failoverCache, html);
  await cacheSafeLanding(failoverCache).catch(() => {});
}

async function refreshShellCache() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch('/admin/index.html', { cache: 'reload' });

  if (response.ok && isHtmlResponse(response)) {
    const html = await response.clone().text();

    if (isAdminShellHtml(html)) {
      await cache.put('/admin/index.html', response.clone());
      await cache.put('/admin/', response.clone());
      await cacheDiscoveredShellAssets(cache, html);
      return response;
    }
  }

  const cached = await cachedAdminShell(cache);

  return cached || await safeLandingResponse('Ubuzima+ could not confirm a valid admin app shell from the server.');
}

function assetRecoveryResponse(url) {
  if (url.pathname.endsWith('.js')) {
    return new Response(
      [
        'window.__UBUZIMA_PWA_ASSET_FAILED__ = true;',
        'window.dispatchEvent(new CustomEvent("ubuzima:pwa-asset-failed", { detail: { asset: ' + JSON.stringify(url.pathname) + ' } }));',
        'var root = document.getElementById("root");',
        'if (root && window.__UBUZIMA_APP_READY__ !== true) {',
        '  root.innerHTML = ' + JSON.stringify('<div class="ubuzima-boot-fallback" role="alert" aria-live="assertive"><div class="ubuzima-boot-fallback__card"><strong>Refresh Ubuzima+</strong><span>The installed app cache is stale. Use Fix app to clear only the Ubuzima+ app cache and reopen.</span><div class="ubuzima-boot-fallback__actions"><button type="button" onclick="window.location.reload()">Reload</button><button class="primary" type="button" onclick="window.ubuzimaClearPwaCache && window.ubuzimaClearPwaCache()">Fix app</button></div></div></div>') + ';',
        '}',
        'window.setTimeout(function () {',
        '  if (window.__UBUZIMA_APP_READY__ !== true) {',
        '    window.location.replace("/admin/pwa-safe.html?reason=asset-load-failed");',
        '  }',
        '}, 1600);'
      ].join('\n'),
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/javascript; charset=utf-8'
        }
      }
    );
  }

  if (url.pathname.endsWith('.css')) {
    return new Response(
      '/* Ubuzima+ skipped a stale stylesheet response. */',
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/css; charset=utf-8'
        }
      }
    );
  }

  return new Response('Asset unavailable', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function shellRecoveryResponse(reason) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#4b5320" />
    <title>Refresh Ubuzima+</title>
    <style>
      :root { color-scheme: light; }
      body {
        min-height: 100dvh;
        margin: 0;
        display: grid;
        place-items: center;
        background: #f4f7f3;
        color: #14241d;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(320px, calc(100vw - 40px));
        padding: 22px;
        border: 1px solid rgba(75, 83, 32, 0.18);
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 18px 46px rgba(20, 36, 29, 0.12);
      }
      strong { display: block; font-size: 1.05rem; }
      p { margin: 8px 0 16px; color: #637369; font-size: 0.88rem; line-height: 1.45; }
      button {
        width: 100%;
        min-height: 44px;
        border: 0;
        border-radius: 8px;
        background: #4b5320;
        color: white;
        font: inherit;
        font-size: 0.86rem;
        font-weight: 900;
      }
    </style>
  </head>
  <body>
    <main class="card" role="alert" aria-live="assertive">
      <strong>Refresh Ubuzima+</strong>
      <p>${reason} This recovery clears only the installed admin app cache, then reopens the app.</p>
      <button type="button" onclick="fixApp()">Fix app</button>
    </main>
    <script>
      async function fixApp() {
        try {
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.filter((registration) => registration.scope.indexOf('/admin/') !== -1).map((registration) => registration.unregister()));
          }
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter((key) => key.indexOf('ubuzima-admin-shell') === 0).map((key) => caches.delete(key)));
          }
        } catch (error) {
          console.warn('Unable to clear Ubuzima+ app cache', error);
        }
        window.location.replace('/admin/?fresh=' + Date.now());
      }
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cacheSeedAssets(cache))
      .then(() => refreshShellCache())
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key.startsWith('ubuzima-admin-shell-'))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UBUZIMA_ADMIN_APP_READY') {
    event.waitUntil(promoteFailoverSnapshot());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (url.pathname === SAFE_LANDING_PATH) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        return fetch(request, { cache: 'reload' }).then(async (response) => {
          if (response.ok && isHtmlResponse(response)) {
            const html = await response.clone().text();

            if (isSafeLandingHtml(html)) {
              await cache.put(SAFE_LANDING_PATH, response.clone());
              const failoverCache = await caches.open(FAILOVER_CACHE_NAME);
              await failoverCache.put(SAFE_LANDING_PATH, response.clone());
              return response;
            }
          }

          return await cachedSafeLanding(cache) || await safeLandingResponse('Ubuzima+ could not load the safe app base.');
        }).catch(async () => await cachedSafeLanding(cache) || await safeLandingResponse('Ubuzima+ opened the cached safe app base.'));
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const failoverCache = await caches.open(FAILOVER_CACHE_NAME);
        const useStableShell = url.searchParams.get('stable') === '1';
        const cachedShell = useStableShell
          ? await cachedAdminShell(failoverCache)
          : await cachedAdminShell(cache);
        const refresh = refreshShellCache().catch(() => undefined);

        if (cachedShell) {
          return cachedShell;
        }

        return refresh.then((response) => response || safeLandingResponse('Ubuzima+ could not open the admin app shell.'));
      })
    );
    return;
  }

  if (
    url.pathname.startsWith('/admin/assets/') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);

        if (cached && isCacheableAssetResponse(cached)) {
          return cached;
        }

        if (cached) {
          await cache.delete(request);
        }

        const failoverCache = await caches.open(FAILOVER_CACHE_NAME);
        const failoverAsset = await failoverCache.match(request);

        if (failoverAsset && isCacheableAssetResponse(failoverAsset)) {
          return failoverAsset;
        }

        return fetch(request, { cache: 'reload' }).then((response) => {
          if (isCacheableAssetResponse(response)) {
            cache.put(request, response.clone()).catch(() => {});
            return response;
          }

          return assetRecoveryResponse(url);
        }).catch(() => assetRecoveryResponse(url));
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          if (response.ok && !isHtmlResponse(response)) {
            cache.put(request, copy);
          }
        }).catch(() => {});

        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || safeLandingResponse('Ubuzima+ could not reach this admin file.')))
  );
});

const CACHE_NAME = 'ubuzima-admin-shell-v20';
const SHELL_ASSETS = [
  '/admin/',
  '/admin/index.html',
  '/admin/manifest.webmanifest',
  '/admin/assets/ubuzima-pwa-icon.svg',
  '/admin/assets/ubuzima-pwa-maskable.svg',
  '/admin/assets/ubuzima-logo.png',
  '/admin/assets/vitapharma-logo.png'
];

function isHtmlResponse(response) {
  return (response.headers.get('content-type') || '').includes('text/html');
}

function isCacheableAssetResponse(response) {
  return response.ok && !isHtmlResponse(response);
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

async function refreshShellCache() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch('/admin/index.html', { cache: 'reload' });

  if (response.ok && isHtmlResponse(response)) {
    const html = await response.clone().text();
    await cache.put('/admin/index.html', response.clone());
    await cache.put('/admin/', response.clone());
    await cacheDiscoveredShellAssets(cache, html);
  }

  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => refreshShellCache())
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
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

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/admin/index.html').then((cachedShell) => {
        const refresh = refreshShellCache().catch(() => undefined);

        if (cachedShell) {
          return cachedShell;
        }

        return refresh.then((response) => response || caches.match('/admin/'));
      })
    );
    return;
  }

  if (
    url.pathname.startsWith('/admin/assets/') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              if (isCacheableAssetResponse(response)) {
                cache.put(request, copy);
              }
            })
            .catch(() => {});

          return response;
        });
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
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/admin/index.html')))
  );
});

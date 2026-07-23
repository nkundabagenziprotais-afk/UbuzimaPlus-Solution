const CACHE_NAME = 'ubuzima-admin-shell-v20260723174656';

// UBUZIMA_ADMIN_SW_NETWORK_FIRST_STABILITY_V1
self.addEventListener('install', (event) => {
  self.skipWaiting();
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

  if (request.method !== 'GET') {
    return;
  }

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/sanctum/') ||
    url.pathname.includes('/auth/')
  ) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (request.mode === 'navigate' || url.pathname.endsWith('/admin/') || url.pathname === '/admin') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => caches.match('/admin/index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        if (!response || !response.ok) {
          return response;
        }

        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (
            url.pathname.startsWith('/admin/assets/') ||
            url.pathname.endsWith('/admin/manifest.webmanifest')
          ) {
            cache.put(request, clone).catch(() => {});
          }
        });

        return response;
      })
      .catch(() => caches.match(request))
  );
});

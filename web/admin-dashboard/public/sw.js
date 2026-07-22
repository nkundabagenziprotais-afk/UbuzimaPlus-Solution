const CACHE_NAME = 'ubuzima-admin-shell-v15';
const SHELL_ASSETS = [
  '/admin/',
  '/admin/index.html',
  '/admin/manifest.webmanifest',
  '/admin/assets/ubuzima-pwa-icon.svg',
  '/admin/assets/ubuzima-pwa-maskable.svg',
  '/admin/assets/ubuzima-logo.png',
  '/admin/assets/vitapharma-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
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
      fetch(request)
        .then((response) => {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => cache.put('/admin/index.html', copy))
            .catch(() => {});

          return response;
        })
        .catch(() => caches.match('/admin/index.html').then((cached) => cached || caches.match('/admin/')))
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
              if (response.ok) {
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
          if (response.ok) {
            cache.put(request, copy);
          }
        }).catch(() => {});

        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/admin/index.html')))
  );
});

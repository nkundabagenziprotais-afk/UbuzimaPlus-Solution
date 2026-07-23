const CACHE_NAME = 'ubuzima-admin-shell-v26';
const SHELL_ASSETS = [
  '/admin/',
  '/admin/index.html',
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
  // UBUZIMA_SW_BYPASS_API_AUTH_V1
  const requestUrl = new URL(event.request.url);

  if (
    event.request.method !== 'GET'
    || requestUrl.pathname.startsWith('/api/')
    || requestUrl.pathname.startsWith('/sanctum/')
    || requestUrl.pathname.startsWith('/broadcasting/')
  ) {
    return;
  }
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
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

"use strict";

/* Ubuzima+ Admin PWA cache — professional, versioned.
   Rules:
   - Never cache HTML navigations, API, or this SW file (always network).
   - Hashed / ?v= fingerprint assets: cache-first (immutable per URL).
   - Icons, fonts, images, manifests: stale-while-revalidate.
   - Other /admin static GET: network-first with cache fallback.
   Bump CACHE_VER when cache policy changes so old buckets are dropped. */

var CACHE_VER = "r231";
var CACHE_IMMUTABLE = "ubuzima-admin-immutable-" + CACHE_VER;
var CACHE_RUNTIME = "ubuzima-admin-runtime-" + CACHE_VER;
var CACHE_PREFIX = "ubuzima-admin-";

var PRECACHE = [
  "/admin/assets/ubuzima-mobile-icon-192.png",
  "/admin/assets/ubuzima-mobile-icon-512.png",
  "/admin/assets/ubuzima-mobile-maskable-512.png",
  "/admin/manifest-mobile.webmanifest"
];

var HASH_IN_PATH = /(?:^|\/)[^/?]*[a-f0-9]{12}\.(?:js|css|mjs|woff2?|ttf|otf|png|jpe?g|webp|svg|gif)(?:\?|$)/i;
var FINGERPRINT_QUERY = /[?&]v=(?:[a-f0-9]{8,}|r?\d[\w.-]*)(?:&|$)/i;

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_RUNTIME).then(function (cache) {
      return cache.addAll(PRECACHE).catch(function () { return undefined; });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (name.indexOf(CACHE_PREFIX) !== 0) { return undefined; }
        if (name === CACHE_IMMUTABLE || name === CACHE_RUNTIME) { return undefined; }
        return caches.delete(name);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isApi(url) {
  return url.pathname.indexOf("/api/") === 0;
}

function isHtml(request, url) {
  if (request.mode === "navigate") { return true; }
  if (request.destination === "document") { return true; }
  if (/\/admin\/?$/.test(url.pathname) || /\/admin\/index\.html$/.test(url.pathname)) { return true; }
  if (/\/admin\/pwa-safe\.html$/.test(url.pathname)) { return true; }
  return false;
}

function isSw(url) {
  return url.pathname === "/admin/sw.js";
}

function isImmutable(url) {
  if (url.pathname.indexOf("/admin/") !== 0) { return false; }
  if (isApi(url) || isSw(url)) { return false; }
  return HASH_IN_PATH.test(url.pathname) || HASH_IN_PATH.test(url.href) || FINGERPRINT_QUERY.test(url.search);
}

function isShellAsset(url) {
  if (url.pathname.indexOf("/admin/") !== 0) { return false; }
  if (/\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname)) { return true; }
  if (/\.webmanifest$/i.test(url.pathname)) { return true; }
  if (url.pathname.indexOf("/admin/assets/") === 0) { return true; }
  return false;
}

function isAdminStatic(url) {
  if (url.pathname.indexOf("/admin/") !== 0) { return false; }
  if (isApi(url) || isSw(url)) { return false; }
  return /\.(?:js|css|mjs|map|json|webmanifest|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);
}

function cachePut(cacheName, request, response) {
  if (!response || !response.ok || response.type === "opaque") { return response; }
  var copy = response.clone();
  caches.open(cacheName).then(function (cache) {
    cache.put(request, copy);
  }).catch(function () {});
  return response;
}

function cacheFirst(cacheName, request) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) { return cached; }
      return fetch(request).then(function (response) {
        return cachePut(cacheName, request, response);
      });
    });
  });
}

function staleWhileRevalidate(cacheName, request) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        return cachePut(cacheName, request, response);
      }).catch(function () {
        return cached;
      });
      return cached || network;
    });
  });
}

function networkFirst(cacheName, request) {
  return fetch(request).then(function (response) {
    return cachePut(cacheName, request, response);
  }).catch(function () {
    return caches.open(cacheName).then(function (cache) {
      return cache.match(request).then(function (cached) {
        if (cached) { return cached; }
        return Response.error();
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url;
  if (request.method !== "GET") { return; }
  try { url = new URL(request.url); } catch (_e) { return; }
  if (url.origin !== self.location.origin) { return; }
  if (isHtml(request, url) || isApi(url) || isSw(url)) { return; }
  if (!isAdminStatic(url) && !isShellAsset(url)) { return; }

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(CACHE_IMMUTABLE, request));
    return;
  }
  if (isShellAsset(url)) {
    event.respondWith(staleWhileRevalidate(CACHE_RUNTIME, request));
    return;
  }
  event.respondWith(networkFirst(CACHE_RUNTIME, request));
});

self.addEventListener("message", function (event) {
  var data = event.data || {};
  if (data === "SKIP_WAITING" || data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

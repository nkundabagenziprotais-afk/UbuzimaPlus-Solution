# Ubuzima+ permanent PWA root shell

The root `/` is intentionally a lightweight launcher, not a second React app.

Stable behavior:
- `/admin/` hosts the real working admin/mobile app.
- `/` redirects installed PWA users to `/admin/?mobile=1&pwa=1&standalone=1&v=<version>`.
- `/manifest.webmanifest` starts at the versioned admin mobile URL.
- `/sw.js` does not cache app shell files and clears old root caches.

Always deploy using `./deploy-admin-and-pwa-stable.sh` so root PWA files cannot drift from the source-controlled templates.

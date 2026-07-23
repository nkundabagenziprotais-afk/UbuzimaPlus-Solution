#!/usr/bin/env bash
set -euo pipefail

NODE_NPM="/home/inzoeqqx/nodevenv/ubuzima-node-app/22/bin/npm"
ADMIN_SRC="web/admin-dashboard"
PWA_SRC="web/pwa-root-shell"
PUBLIC="public_html"
ADMIN="$PUBLIC/admin"
VERSION="$(date +%Y%m%d%H%M%S)"

echo "=== BUILD ADMIN ==="
"$NODE_NPM" --prefix "$ADMIN_SRC" run typecheck
"$NODE_NPM" --prefix "$ADMIN_SRC" run build

echo
echo "=== STAMP ADMIN SERVICE WORKER ==="
python3 - <<PY
from pathlib import Path
import re

version = "$VERSION"

for file in [
    Path("web/admin-dashboard/dist/sw.js"),
    Path("web/admin-dashboard/public/sw.js"),
]:
    if file.exists():
        text = file.read_text()
        text = re.sub(
            r"ubuzima-admin-shell-v\\d+",
            f"ubuzima-admin-shell-v{version}",
            text,
            count=1,
        )
        file.write_text(text)
        print(f"updated {file}")
PY

echo
echo "=== DEPLOY ADMIN BUILD ==="
rsync -av --delete "$ADMIN_SRC/dist/" "$ADMIN/"

echo
echo "=== INSTALL API/SANCTUM LARAVEL FRONT CONTROLLER SHIMS ==="
mkdir -p "$PUBLIC/api" "$PUBLIC/sanctum"

cat > "$PUBLIC/api/index.php" <<'PHP'
<?php
declare(strict_types=1);

$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/../../backend/public/index.php';

require __DIR__ . '/../../backend/public/index.php';
PHP

cat > "$PUBLIC/sanctum/index.php" <<'PHP'
<?php
declare(strict_types=1);

$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/../../backend/public/index.php';

require __DIR__ . '/../../backend/public/index.php';
PHP

cat > "$PUBLIC/api/.htaccess" <<'HT'
DirectoryIndex index.php

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^ index.php [L,QSA]
</IfModule>
HT

cat > "$PUBLIC/sanctum/.htaccess" <<'HT'
DirectoryIndex index.php

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^ index.php [L,QSA]
</IfModule>
HT

echo
echo "=== INSTALL ROOT LANDING + ROOT KILL-SWITCH ==="
python3 - <<PY
from pathlib import Path

version = "$VERSION"
src = Path("web/pwa-root-shell")
public = Path("public_html")
admin = public / "admin"

(public / "index.html").write_text((src / "index.html.tpl").read_text())
(public / "sw.js").write_text((src / "sw.js.tpl").read_text().replace("__VERSION__", version))
(public / ".htaccess").write_text((src / "root.htaccess.tpl").read_text())
(admin / ".htaccess").write_text((src / "admin.htaccess.tpl").read_text())
PY

echo
echo "=== INSTALL ADMIN-SCOPED MANIFEST + INSTALL PAGE ==="
cat > "$ADMIN/manifest.webmanifest" < "$PWA_SRC/manifest.webmanifest.tpl"

python3 - <<'PY'
from pathlib import Path
import re

path = Path("public_html/admin/index.html")
text = path.read_text()

text = re.sub(
    r'<link rel="manifest" href="[^"]*" ?/?>',
    '<link rel="manifest" href="/admin/manifest.webmanifest" />',
    text,
)

if '<link rel="manifest"' not in text:
    text = text.replace('</head>', '    <link rel="manifest" href="/admin/manifest.webmanifest" />\n  </head>', 1)

text = re.sub(
    r'<link rel="apple-touch-icon" href="[^"]*" ?/?>',
    '<link rel="apple-touch-icon" href="/admin/assets/ubuzima-logo.png" />',
    text,
)

path.write_text(text)
PY

cat > "$ADMIN/pwa-install.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f766e" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Ubuzima+" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="manifest" href="/admin/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/admin/assets/ubuzima-logo.png" />
    <title>Install Ubuzima+ Mobile</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(135deg, #ecfeff 0%, #f8fafc 100%);
        color: #0f172a;
      }

      main {
        max-width: 560px;
        margin: 0 auto;
        background: white;
        border-radius: 28px;
        padding: 24px;
        box-shadow: 0 22px 60px rgba(15, 23, 42, 0.14);
      }

      img {
        width: 76px;
        height: 76px;
        border-radius: 22px;
      }

      h1 {
        color: #0f766e;
      }

      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 16px;
        border-radius: 999px;
        background: #0f766e;
        color: white;
        font-weight: 800;
        text-decoration: none;
        margin-top: 12px;
      }

      .muted {
        color: #64748b;
        line-height: 1.55;
      }
    </style>
    <script>
      async function cleanupRootPwa() {
        try {
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
              if (registration.scope === location.origin + '/') {
                await registration.unregister();
              }
            }
          }

          if ('caches' in window) {
            const keys = await caches.keys();
            for (const key of keys) {
              if (key.indexOf('ubuzima-root') !== -1) {
                await caches.delete(key);
              }
            }
          }
        } catch (_) {}
      }

      window.addEventListener('load', cleanupRootPwa);
    </script>
  </head>
  <body>
    <main>
      <img src="/admin/assets/ubuzima-logo.png" alt="Ubuzima+" />
      <h1>Ubuzima+ Mobile is ready</h1>
      <p class="muted">
        Use this page to install or open the stable mobile app. The PWA is scoped under /admin/ to avoid old root-cache white screens.
      </p>
      <a href="/admin/?mobile=1&pwa=1&standalone=1&admin-scope=1">Open Ubuzima+ Mobile</a>
      <p class="muted">
        For Home Screen installation, add this page to the Home Screen after it opens correctly.
      </p>
      <img src="/pwa-phone-ping.php?source=admin-pwa-install" width="1" height="1" alt="" />
    </main>
  </body>
</html>
HTML

echo
echo "=== CLEAR BACKEND CACHE ==="
php backend/artisan route:clear >/dev/null 2>&1 || true
php backend/artisan config:clear >/dev/null 2>&1 || true
php backend/artisan cache:clear >/dev/null 2>&1 || true

echo
echo "=== VERIFY LIVE PWA + API ==="
grep -n "manifest.webmanifest\\|apple-touch-icon" public_html/admin/index.html | head -20 || true
grep -n "start_url\\|scope" public_html/admin/manifest.webmanifest
grep -n "ubuzima-root-kill-switch" public_html/sw.js || true

for url in \
  "https://ubuzimaplus.com/" \
  "https://ubuzimaplus.com/admin/pwa-install.html" \
  "https://ubuzimaplus.com/admin/manifest.webmanifest" \
  "https://ubuzimaplus.com/admin/?mobile=1&pwa=1&standalone=1&admin-scope=1" \
  "https://ubuzimaplus.com/api/v1/auth/login" \
  "https://ubuzimaplus.com/sanctum/csrf-cookie"
do
  echo
  echo "--- $url"
  curl -kI --max-time 20 "$url" || true
done

echo
echo "--- POST /api/v1/auth/login {} should return 422 JSON"
TMP_BODY="$(mktemp)"
HTTP_CODE="$(curl -ksS --max-time 30 \
  -o "$TMP_BODY" \
  -w "%{http_code}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://ubuzimaplus.com/api/v1/auth/login || true)"
echo "HTTP_CODE=$HTTP_CODE"
cat "$TMP_BODY"
echo
rm -f "$TMP_BODY"

echo
echo "DONE."

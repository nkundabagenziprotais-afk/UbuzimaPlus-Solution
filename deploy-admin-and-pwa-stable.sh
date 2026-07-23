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
echo "=== INSTALL PUBLIC COMMERCIAL ROOT + ROOT KILL SWITCH ==="
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

# Remove root manifest so public visitors never receive a PWA install signal.
root_manifest = public / "manifest.webmanifest"
if root_manifest.exists():
    root_manifest.unlink()
PY

echo
echo "=== INSTALL STAFF-ONLY ADMIN PWA FILES ==="
cat > "$ADMIN/manifest.webmanifest" < "$PWA_SRC/manifest.webmanifest.tpl"

python3 - <<'PY'
from pathlib import Path
import re

path = Path("public_html/admin/index.html")
text = path.read_text()

# Do not expose manifest on login/admin index. The install signal comes only from
# the post-login dashboard prompt and /admin/pwa-install.html.
text = re.sub(r'\s*<link rel="manifest" href="[^"]*" ?/?>', '', text)
text = re.sub(
    r'<link rel="apple-touch-icon" href="[^"]*" ?/?>',
    '<link rel="apple-touch-icon" href="/admin/assets/ubuzima-logo.png" />',
    text,
)

install_prompt = r'''
    <script>
      // UBUZIMA_DASHBOARD_ONLY_PWA_INSTALL_PROMPT_V1
      (function () {
        var installPath = '/admin/pwa-install.html?from=dashboard';
        var dismissedKey = 'ubuzima:pwa-install-dismissed:v1';
        var promptId = 'ubuzima-dashboard-install-prompt';

        function hasLikelyAuthenticatedSession() {
          try {
            var authKeyPattern = /(token|auth|access|profile|session|user|tenant)/i;

            for (var index = 0; index < localStorage.length; index += 1) {
              var key = localStorage.key(index) || '';
              var value = localStorage.getItem(key) || '';

              if (authKeyPattern.test(key) && value && value.length > 8) {
                return true;
              }

              if (authKeyPattern.test(value) && value.length > 20) {
                return true;
              }
            }
          } catch (_) {}

          return false;
        }

        function isLoginLikeScreen() {
          var text = (document.body && document.body.innerText ? document.body.innerText : '').toLowerCase();
          return (
            text.includes('staff phone') ||
            text.includes('pin') ||
            text.includes('login') ||
            text.includes('sign in')
          ) && !text.includes('dashboard');
        }

        function showInstallPrompt() {
          if (document.getElementById(promptId)) return;
          if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
          if (window.navigator.standalone === true) return;
          if (localStorage.getItem(dismissedKey) === '1') return;
          if (!hasLikelyAuthenticatedSession()) return;
          if (isLoginLikeScreen()) return;

          var box = document.createElement('aside');
          box.id = promptId;
          box.setAttribute('role', 'complementary');
          box.innerHTML = ''
            + '<div style="position:fixed;right:18px;bottom:18px;z-index:2147483000;max-width:360px;background:#fff;border:1px solid rgba(15,118,110,.2);border-radius:22px;box-shadow:0 22px 60px rgba(15,23,42,.18);padding:16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a;">'
            + '<strong style="display:block;font-size:15px;margin-bottom:4px;">Install Ubuzima+ Mobile</strong>'
            + '<span style="display:block;color:#64748b;font-size:13px;line-height:1.45;">Install the mobile app on this trusted staff device for faster dashboard access.</span>'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
            + '<a href="' + installPath + '" style="display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 13px;border-radius:999px;background:#0f766e;color:#fff;font-weight:800;text-decoration:none;font-size:13px;">Install app</a>'
            + '<button type="button" data-dismiss style="min-height:38px;padding:0 13px;border-radius:999px;border:1px solid rgba(100,116,139,.3);background:#fff;color:#475569;font-weight:800;font-size:13px;">Not now</button>'
            + '</div>'
            + '</div>';

          document.body.appendChild(box);

          var dismiss = box.querySelector('[data-dismiss]');
          if (dismiss) {
            dismiss.addEventListener('click', function () {
              localStorage.setItem(dismissedKey, '1');
              box.remove();
            });
          }
        }

        window.addEventListener('load', function () {
          setTimeout(showInstallPrompt, 3500);
          setInterval(showInstallPrompt, 7000);
        });
      })();
    </script>
'''

if "UBUZIMA_DASHBOARD_ONLY_PWA_INSTALL_PROMPT_V1" not in text:
    text = text.replace("</head>", install_prompt + "\n  </head>", 1)

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
        max-width: 620px;
        margin: 0 auto;
        background: white;
        border-radius: 28px;
        padding: 24px;
        box-shadow: 0 22px 60px rgba(15, 23, 42, 0.14);
      }

      img.logo {
        width: 76px;
        height: 76px;
        border-radius: 22px;
      }

      h1 {
        color: #0f766e;
      }

      a, button {
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
        border: 0;
        margin-top: 12px;
      }

      .secondary {
        background: #fff;
        color: #0f766e;
        border: 1px solid rgba(15, 118, 110, 0.22);
      }

      .muted {
        color: #64748b;
        line-height: 1.55;
      }

      .note {
        padding: 0.85rem;
        background: #f8fafc;
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.25);
        color: #475569;
        margin-top: 1rem;
      }
    </style>
    <script>
      let deferredInstallPrompt = null;

      window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        var button = document.getElementById('install-button');
        if (button) {
          button.hidden = false;
        }
      });

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

      async function installApp() {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice.catch(function () {});
          deferredInstallPrompt = null;
          return;
        }

        document.getElementById('ios-help').hidden = false;
      }

      window.addEventListener('load', cleanupRootPwa);
    </script>
  </head>
  <body>
    <main>
      <img class="logo" src="/admin/assets/ubuzima-logo.png" alt="Ubuzima+" />
      <h1>Install Ubuzima+ Mobile</h1>
      <p class="muted">
        Install this app only on a trusted staff device after logging in to the dashboard.
        Public visitors are not asked to install the app.
      </p>

      <button id="install-button" type="button" onclick="installApp()">Install app</button>
      <a class="secondary" href="/admin/">Return to dashboard</a>

      <div id="ios-help" class="note" hidden>
        On iPhone or iPad, use the browser share menu and choose <strong>Add to Home Screen</strong>.
        If the installed icon opens an old blank page, remove the old icon first, reopen this page from the dashboard, and add it again.
      </div>

      <p class="note">
        The installed app opens at <strong>/admin/</strong>, not at the public website and not at a temporary install page.
      </p>
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
echo "=== VERIFY LIVE COMMERCIAL PWA FLOW ==="
grep -n "UBUZIMA_DASHBOARD_ONLY_PWA_INSTALL_PROMPT_V1\\|manifest.webmanifest\\|apple-touch-icon" public_html/admin/index.html | head -40 || true
grep -n "start_url\\|scope" public_html/admin/manifest.webmanifest
grep -n "ubuzima-root-kill-switch" public_html/sw.js || true
grep -n "manifest.webmanifest" public_html/index.html || echo "OK: public root has no manifest link"

for url in \
  "https://ubuzimaplus.com/" \
  "https://ubuzimaplus.com/admin/" \
  "https://ubuzimaplus.com/admin/pwa-install.html" \
  "https://ubuzimaplus.com/admin/manifest.webmanifest" \
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

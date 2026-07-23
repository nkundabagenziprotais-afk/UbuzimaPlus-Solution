#!/usr/bin/env bash
set -euo pipefail

NODE_NPM="/home/inzoeqqx/nodevenv/ubuzima-node-app/22/bin/npm"
ADMIN_SRC="web/admin-dashboard"
PWA_SRC="web/pwa-root-shell"
PUBLIC="public_html"
ADMIN="$PUBLIC/admin"
VERSION="$(date +%Y%m%d%H%M%S)"
APP_START="/admin/?mobile=1&pwa=1&standalone=1&v=$VERSION"

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
echo "=== INSTALL PERMANENT PWA ROOT SHELL ==="
python3 - <<PY
from pathlib import Path

version = "$VERSION"
app_start = "$APP_START"

src = Path("web/pwa-root-shell")
public = Path("public_html")
admin = public / "admin"

(public / "index.html").write_text((src / "index.html.tpl").read_text().replace("__APP_START__", app_start))
(public / "manifest.webmanifest").write_text((src / "manifest.webmanifest.tpl").read_text().replace("__APP_START__", app_start))
(public / "sw.js").write_text((src / "sw.js.tpl").read_text().replace("__VERSION__", version))
(public / ".htaccess").write_text((src / "root.htaccess.tpl").read_text())
(admin / ".htaccess").write_text((src / "admin.htaccess.tpl").read_text())

print("root index.html start_url:", app_start)
print("root sw version:", version)
PY

echo
echo "=== PATCH ADMIN INDEX WITH STANDALONE REPAIR ==="
python3 - <<'PY'
from pathlib import Path

path = Path("public_html/admin/index.html")
text = path.read_text()

repair = """
    <script>
      // UBUZIMA_PWA_STANDALONE_REPAIR_PERMANENT_V2
      (function () {
        var params = new URLSearchParams(window.location.search);
        var isStandalone =
          params.get('pwa') === '1' ||
          params.get('standalone') === '1' ||
          window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone === true;

        if (!isStandalone || !('serviceWorker' in navigator)) {
          return;
        }

        navigator.serviceWorker.getRegistrations()
          .then(function (registrations) {
            registrations.forEach(function (registration) {
              if (registration.scope === window.location.origin + '/') {
                registration.unregister().catch(function () {});
              }
            });
          })
          .catch(function () {});
      })();
    </script>
"""

if "UBUZIMA_PWA_STANDALONE_REPAIR_PERMANENT_V2" not in text:
    text = text.replace("</head>", repair + "\n  </head>", 1)

path.write_text(text)
PY

echo

echo
echo "=== INSTALL API/SANCTUM LARAVEL FRONT CONTROLLER SHIMS ==="
mkdir -p "$PUBLIC/api" "$PUBLIC/sanctum"

cat > "$PUBLIC/api/index.php" <<'PHP'
<?php
declare(strict_types=1);

// Preserve the original /api/... request path for Laravel route matching.
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/../../backend/public/index.php';

require __DIR__ . '/../../backend/public/index.php';
PHP

cat > "$PUBLIC/sanctum/index.php" <<'PHP'
<?php
declare(strict_types=1);

// Preserve the original /sanctum/... request path for Laravel route matching.
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
echo "=== LIVE VERIFY ==="
grep -nE "refresh|location.replace|Open Ubuzima|admin|PERMANENT|NO_WAIT" public_html/index.html | head -100 || true
grep -n "start_url\\|scope" public_html/manifest.webmanifest
grep -n "CACHE_NAME\\|self-destruct\\|NETWORK_FIRST" public_html/sw.js public_html/admin/sw.js || true
grep -n "UBUZIMA_PWA_STANDALONE_REPAIR_PERMANENT_V2" public_html/admin/index.html || true
grep -n "Cache-Control" public_html/.htaccess public_html/admin/.htaccess || true

curl -kI --max-time 20 https://ubuzimaplus.com/ || true
curl -kI --max-time 20 "https://ubuzimaplus.com$APP_START" || true
curl -kI --max-time 20 https://ubuzimaplus.com/manifest.webmanifest || true
curl -kI --max-time 20 https://ubuzimaplus.com/sw.js || true
curl -kI --max-time 20 https://ubuzimaplus.com/admin/sw.js || true

echo
echo "DONE. PWA start URL: $APP_START"

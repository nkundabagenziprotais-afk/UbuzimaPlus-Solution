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

index = (src / "index.html.tpl").read_text()
manifest = (src / "manifest.webmanifest.tpl").read_text()
sw = (src / "sw.js.tpl").read_text()

(public / "index.html").write_text(index.replace("__APP_START__", app_start))
(public / "manifest.webmanifest").write_text(manifest.replace("__APP_START__", app_start))
(public / "sw.js").write_text(sw.replace("__VERSION__", version))

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
      // UBUZIMA_PWA_STANDALONE_REPAIR_PERMANENT_V1
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

if "UBUZIMA_PWA_STANDALONE_REPAIR_PERMANENT_V1" not in text:
    text = text.replace("</head>", repair + "\n  </head>", 1)

path.write_text(text)
PY

echo
echo "=== CLEAR BACKEND CACHE ==="
php backend/artisan route:clear >/dev/null 2>&1 || true
php backend/artisan config:clear >/dev/null 2>&1 || true
php backend/artisan cache:clear >/dev/null 2>&1 || true

echo
echo "=== LIVE VERIFY ==="
grep -nE "refresh|location.replace|Open Ubuzima|admin|PERMANENT" public_html/index.html | head -80 || true
grep -n "start_url" public_html/manifest.webmanifest
grep -n "CACHE_NAME" public_html/sw.js public_html/admin/sw.js || true
grep -n "UBUZIMA_PWA_STANDALONE_REPAIR_PERMANENT_V1" public_html/admin/index.html || true

curl -kI --max-time 20 https://ubuzimaplus.com/ || true
curl -kI --max-time 20 "https://ubuzimaplus.com$APP_START" || true
curl -kI --max-time 20 https://ubuzimaplus.com/manifest.webmanifest || true
curl -kI --max-time 20 https://ubuzimaplus.com/sw.js || true

echo
echo "DONE. PWA start URL: $APP_START"

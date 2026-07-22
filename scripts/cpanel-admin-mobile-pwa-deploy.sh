#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${UBUZIMA_RELEASE_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ADMIN_DIR="$ROOT_DIR/web/admin-dashboard"
AUDIT_SCRIPT="$ROOT_DIR/scripts/cpanel-admin-mobile-pwa-audit.sh"
ADMIN_WEB_ROOT="${ADMIN_WEB_ROOT:-}"
BACKUP_ROOT="${BACKUP_ROOT:-${HOME:-$ROOT_DIR}/ubuzima-admin-backups}"
CONFIRM_DEPLOY="${CONFIRM_DEPLOY:-}"
PUBLIC_ADMIN_URL="${PUBLIC_ADMIN_URL:-}"

if [ "$CONFIRM_DEPLOY" != "DEPLOY_UBUZIMA_ADMIN" ]; then
  echo "Refusing deploy. Re-run with CONFIRM_DEPLOY=DEPLOY_UBUZIMA_ADMIN."
  exit 1
fi

if [ -z "$ADMIN_WEB_ROOT" ]; then
  echo "Set ADMIN_WEB_ROOT to the cPanel /admin web root, for example:"
  echo "ADMIN_WEB_ROOT=/home/USER/public_html/admin"
  exit 1
fi

case "$ADMIN_WEB_ROOT" in
  */admin|*/admin/) ;;
  *)
    echo "ADMIN_WEB_ROOT must end with /admin to avoid touching the wrong production path."
    exit 1
    ;;
esac

if [ "$ADMIN_WEB_ROOT" = "/" ] || [ "$ADMIN_WEB_ROOT" = "$HOME" ]; then
  echo "Unsafe ADMIN_WEB_ROOT: $ADMIN_WEB_ROOT"
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required on cPanel for safe deploy."
  exit 1
fi

cd "$ROOT_DIR"
"$AUDIT_SCRIPT"

timestamp="$(date -u +%Y%m%d-%H%M%S)"
backup_dir="$BACKUP_ROOT/admin-$timestamp"
mkdir -p "$backup_dir"

echo "== Backup current production admin =="
if [ -d "$ADMIN_WEB_ROOT" ] && [ -n "$(find "$ADMIN_WEB_ROOT" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  rsync -a "$ADMIN_WEB_ROOT"/ "$backup_dir"/
else
  echo "Target admin web root is empty or does not exist yet." > "$backup_dir/EMPTY_TARGET.txt"
fi

if find "$ADMIN_WEB_ROOT" -maxdepth 2 \( -name '.env' -o -name '.env.*' -o -name 'database.sqlite' -o -name '*.sqlite' -o -name 'storage' -o -name 'database' \) -print -quit 2>/dev/null | grep -q .; then
  echo "Protected runtime files/folders were found inside ADMIN_WEB_ROOT. Refusing deploy."
  echo "Check that ADMIN_WEB_ROOT points only to the static /admin folder."
  exit 1
fi

mkdir -p "$ADMIN_WEB_ROOT"

echo "== Deploy approved admin dist to $ADMIN_WEB_ROOT =="
rsync -a --delete \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'storage/***' \
  --exclude 'database/***' \
  --exclude '*.sqlite' \
  "$ADMIN_DIR/dist"/ "$ADMIN_WEB_ROOT"/

cat > "$ADMIN_WEB_ROOT/UBUZIMA_ADMIN_RELEASE.txt" <<MARKER
Ubuzima+ Admin Mobile PWA release
Commit: $(git rev-parse HEAD)
Deployed UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Backup: $backup_dir
MARKER

test -f "$ADMIN_WEB_ROOT/index.html"
test -f "$ADMIN_WEB_ROOT/manifest.webmanifest"
test -f "$ADMIN_WEB_ROOT/sw.js"

if [ -n "$PUBLIC_ADMIN_URL" ] && command -v curl >/dev/null 2>&1; then
  base_url="${PUBLIC_ADMIN_URL%/}"
  echo "== Live URL verification =="
  curl -fsSI "$base_url/" >/dev/null
  curl -fsSI "$base_url/manifest.webmanifest" >/dev/null
  curl -fsSI "$base_url/sw.js" >/dev/null
fi

echo "Deploy completed."
echo "Backup created at: $backup_dir"
echo "Rollback command:"
echo "CONFIRM_ROLLBACK=ROLLBACK_UBUZIMA_ADMIN ADMIN_WEB_ROOT=\"$ADMIN_WEB_ROOT\" BACKUP_DIR=\"$backup_dir\" scripts/cpanel-admin-mobile-pwa-rollback.sh"

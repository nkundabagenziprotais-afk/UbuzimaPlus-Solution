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

verify_live_asset() {
  local asset_url="$1"
  local asset_path="$2"
  local headers_file
  local body_file
  local content_type

  headers_file="$(mktemp)"
  body_file="$(mktemp)"

  if ! curl -fsSL -D "$headers_file" -o "$body_file" "$asset_url"; then
    rm -f "$headers_file" "$body_file"
    echo "Live asset is not reachable: $asset_url"
    exit 1
  fi

  content_type="$(grep -i '^content-type:' "$headers_file" | head -n 1 | tr -d '\r' || true)"

  if head -c 128 "$body_file" | grep -Eiq '<!doctype|<html'; then
    rm -f "$headers_file" "$body_file"
    echo "Live asset returned HTML instead of a static file: $asset_url"
    exit 1
  fi

  case "$asset_path" in
    *.js)
      echo "$content_type" | grep -Eiq 'javascript|ecmascript|text/plain' || {
        rm -f "$headers_file" "$body_file"
        echo "Live JS asset has unexpected content type: $asset_url ($content_type)"
        exit 1
      }
      ;;
    *.css)
      echo "$content_type" | grep -Eiq 'text/css|text/plain' || {
        rm -f "$headers_file" "$body_file"
        echo "Live CSS asset has unexpected content type: $asset_url ($content_type)"
        exit 1
      }
      ;;
  esac

  rm -f "$headers_file" "$body_file"
}

verify_live_api_health() {
  local api_url="$1"
  local headers_file
  local body_file
  local content_type

  headers_file="$(mktemp)"
  body_file="$(mktemp)"

  if ! curl -fsSL -D "$headers_file" -o "$body_file" "$api_url"; then
    rm -f "$headers_file" "$body_file"
    echo "Live API health check failed: $api_url"
    echo "This causes browser 'Failed to fetch'. Check that /api routes reach the Laravel backend."
    exit 1
  fi

  content_type="$(grep -i '^content-type:' "$headers_file" | head -n 1 | tr -d '\r' || true)"

  if head -c 128 "$body_file" | grep -Eiq '<!doctype|<html'; then
    rm -f "$headers_file" "$body_file"
    echo "Live API returned HTML instead of JSON: $api_url"
    echo "This causes browser 'Failed to fetch'. Check the public web-root .htaccess and backend index.php routing."
    exit 1
  fi

  echo "$content_type" | grep -Eiq 'application/json|text/json|text/plain' || {
    rm -f "$headers_file" "$body_file"
    echo "Live API has unexpected content type: $api_url ($content_type)"
    exit 1
  }

  grep -Fq '"service":"backend-api"' "$body_file" || grep -Fq '"service": "backend-api"' "$body_file" || {
    rm -f "$headers_file" "$body_file"
    echo "Live API health response did not identify backend-api: $api_url"
    exit 1
  }

  rm -f "$headers_file" "$body_file"
}

cd "$ROOT_DIR"
"$AUDIT_SCRIPT"

current_commit="$(git rev-parse HEAD)"
release_short="$(git rev-parse --short HEAD)"
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
  --exclude 'assets/***' \
  "$ADMIN_DIR/dist"/ "$ADMIN_WEB_ROOT"/

mkdir -p "$ADMIN_WEB_ROOT/assets"
rsync -a "$ADMIN_DIR/dist/assets"/ "$ADMIN_WEB_ROOT/assets"/

while IFS= read -r asset_path; do
  deployed_asset="$ADMIN_WEB_ROOT/${asset_path#/admin/}"
  source_asset="$ADMIN_DIR/dist/${asset_path#/admin/}"

  test -f "$source_asset"
  test -f "$deployed_asset"
  cmp -s "$source_asset" "$deployed_asset" || {
    echo "Deployed asset does not match build output: $asset_path"
    exit 1
  }
done < <(grep -Eo '/admin/assets/[^"]+' "$ADMIN_DIR/dist/index.html" | sort -u)

cat > "$ADMIN_WEB_ROOT/UBUZIMA_ADMIN_RELEASE.txt" <<MARKER
Ubuzima+ Admin Mobile PWA release
Commit: $current_commit
Deployed UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Backup: $backup_dir
MARKER

test -f "$ADMIN_WEB_ROOT/index.html"
test -f "$ADMIN_WEB_ROOT/manifest.webmanifest"
test -f "$ADMIN_WEB_ROOT/sw.js"

if [ -n "$PUBLIC_ADMIN_URL" ] && command -v curl >/dev/null 2>&1; then
  base_url="${PUBLIC_ADMIN_URL%/}"
  asset_origin="${base_url%/admin}"

  if [ "$asset_origin" = "$base_url" ]; then
    asset_origin="$base_url"
  fi

  echo "== Live URL verification =="
  verify_live_api_health "$asset_origin/api/v1/health?release=$release_short"

  live_index="$(curl -fsSL "$base_url/?release=$release_short")"
  while IFS= read -r asset_path; do
    if [ -z "$asset_path" ]; then
      continue
    fi

    echo "$live_index" | grep -Fq "$asset_path"
    verify_live_asset "$asset_origin$asset_path?release=$release_short" "$asset_path"
  done < <(grep -Eo '/admin/assets/[^"]+' "$ADMIN_DIR/dist/index.html" | sort -u)

  expected_cache_line="$(grep -F 'const CACHE_NAME' "$ADMIN_DIR/dist/sw.js" | head -n 1)"
  curl -fsSL "$base_url/sw.js?release=$release_short" | grep -Fq "$expected_cache_line"
  curl -fsSL "$base_url/UBUZIMA_ADMIN_RELEASE.txt?release=$release_short" | grep -Fq "Commit: $current_commit"
  curl -fsSI "$base_url/manifest.webmanifest?release=$release_short" \
    | grep -Eiq 'content-type: *(application/manifest\+json|application/json)'
fi

echo "Deploy completed."
echo "Backup created at: $backup_dir"
echo "Rollback command:"
echo "CONFIRM_ROLLBACK=ROLLBACK_UBUZIMA_ADMIN ADMIN_WEB_ROOT=\"$ADMIN_WEB_ROOT\" BACKUP_DIR=\"$backup_dir\" scripts/cpanel-admin-mobile-pwa-rollback.sh"

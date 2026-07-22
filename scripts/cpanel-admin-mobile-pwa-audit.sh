#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${UBUZIMA_RELEASE_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ADMIN_DIR="$ROOT_DIR/web/admin-dashboard"
SKIP_NPM_BUILD="${SKIP_NPM_BUILD:-0}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-}"
NPM_BIN="${NPM_BIN:-npm}"

require_file() {
  local file="$1"

  if [ ! -f "$file" ]; then
    echo "Missing required file: $file"
    exit 1
  fi
}

checksum_file() {
  local file="$1"

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file"
    return
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file"
    return
  fi

  echo "No SHA-256 checksum command found. Install shasum or sha256sum."
  exit 1
}

echo "== Ubuzima+ Admin Mobile PWA cPanel audit =="
cd "$ROOT_DIR"

current_branch="$(git branch --show-current || true)"
current_commit="$(git rev-parse HEAD)"
echo "Branch: ${current_branch:-detached}"
echo "Commit: ${current_commit}"

if [ -n "$EXPECTED_COMMIT" ]; then
  case "$current_commit" in
    "$EXPECTED_COMMIT"*) ;;
    *)
      echo "Current commit does not match EXPECTED_COMMIT=$EXPECTED_COMMIT"
      exit 1
      ;;
  esac
fi

source_dirty="$(git status --porcelain -- . ':(exclude)web/admin-dashboard/dist' || true)"
if [ -n "$source_dirty" ]; then
  echo "Source tree has uncommitted changes outside generated dist:"
  echo "$source_dirty"
  exit 1
fi

protected_hits="$(
  git ls-files \
    | grep -E '(^|/)\.env$|(^|/)\.env\.(local|production|backup|bak|old)$|(^|/)database/database\.sqlite$|\.sqlite$|(^|/)storage/logs/|(^|/)node_modules/|(^|/)\.DS_Store$|\.tar$|\.tar\.gz$|\.zip$|(^|/)public_html/|\.pem$|\.key$|id_rsa|id_ed25519' \
    | grep -vE '(^|/)\.env\.example$|(^|/)storage/logs/\.gitignore$' \
    || true
)"

if [ -n "$protected_hits" ]; then
  echo "Protected tracked files found. Refusing release:"
  echo "$protected_hits"
  exit 1
fi

require_file "$ADMIN_DIR/package.json"
require_file "$ADMIN_DIR/package-lock.json"
require_file "$ADMIN_DIR/index.html"
require_file "$ADMIN_DIR/public/manifest.webmanifest"
require_file "$ADMIN_DIR/public/sw.js"
require_file "$ADMIN_DIR/public/.htaccess"
require_file "$ADMIN_DIR/src/main.tsx"

grep -Fq 'AddType application/manifest+json .webmanifest' "$ADMIN_DIR/public/.htaccess"
grep -Fq 'href="/admin/manifest.webmanifest"' "$ADMIN_DIR/index.html"
grep -Fq 'href="/admin/assets/ubuzima-pwa-icon.svg"' "$ADMIN_DIR/index.html"
grep -Fq '"start_url": "/admin/' "$ADMIN_DIR/public/manifest.webmanifest"
grep -Fq '"scope": "/admin/"' "$ADMIN_DIR/public/manifest.webmanifest"
grep -Fq '"display": "standalone"' "$ADMIN_DIR/public/manifest.webmanifest"
grep -Fq "navigator.serviceWorker.register('/admin/sw.js'" "$ADMIN_DIR/src/main.tsx"
grep -Fq "ubuzima-admin-shell-v16" "$ADMIN_DIR/public/sw.js"

if [ "$SKIP_NPM_BUILD" != "1" ]; then
  if ! "$NPM_BIN" --version >/dev/null 2>&1; then
    echo "npm is required for build audit. Set NPM_BIN=/path/to/npm if cPanel uses a Node virtualenv."
    echo "Set SKIP_NPM_BUILD=1 only if dist is already built and reviewed."
    exit 1
  fi

  if [ ! -d "$ADMIN_DIR/node_modules" ]; then
    "$NPM_BIN" --prefix "$ADMIN_DIR" ci
  fi

  "$NPM_BIN" --prefix "$ADMIN_DIR" run typecheck
  "$NPM_BIN" --prefix "$ADMIN_DIR" run build
  "$NPM_BIN" --prefix "$ADMIN_DIR" run native:doctor
fi

require_file "$ADMIN_DIR/dist/index.html"
require_file "$ADMIN_DIR/dist/manifest.webmanifest"
require_file "$ADMIN_DIR/dist/sw.js"
require_file "$ADMIN_DIR/dist/.htaccess"
grep -Fq 'AddType application/manifest+json .webmanifest' "$ADMIN_DIR/dist/.htaccess"

dist_protected_hits="$(
  find "$ADMIN_DIR/dist" -type f \
    | grep -E '(^|/)\.env($|\.)|\.sqlite$|\.pem$|\.key$|id_rsa|id_ed25519|\.tar$|\.tar\.gz$|\.zip$' \
    || true
)"

if [ -n "$dist_protected_hits" ]; then
  echo "Protected files found in dist. Refusing release:"
  echo "$dist_protected_hits"
  exit 1
fi

echo "== Dist checksums =="
(
  cd "$ADMIN_DIR/dist"
  while IFS= read -r file; do
    checksum_file "$file"
  done < <(find . -maxdepth 3 -type f | sort)
)

echo "cPanel audit passed. No production files were changed."

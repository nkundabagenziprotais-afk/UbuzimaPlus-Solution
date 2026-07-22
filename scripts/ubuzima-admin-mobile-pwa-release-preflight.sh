#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_DIR="$ROOT_DIR/web/admin-dashboard"

require_file() {
  local file="$1"

  if [ ! -f "$file" ]; then
    echo "Missing required file: $file"
    exit 1
  fi
}

echo "== Ubuzima+ Admin mobile PWA release preflight =="
cd "$ROOT_DIR"
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse --short HEAD)"
git status -sb

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean. Commit or stash changes before release packaging."
  exit 1
fi

require_file "$ADMIN_DIR/package.json"
require_file "$ADMIN_DIR/package-lock.json"
require_file "$ADMIN_DIR/index.html"
require_file "$ADMIN_DIR/public/manifest.webmanifest"
require_file "$ADMIN_DIR/public/sw.js"

if [ ! -d "$ADMIN_DIR/node_modules" ]; then
  echo "Installing admin dashboard dependencies with npm ci"
  npm --prefix "$ADMIN_DIR" ci
fi

echo "== TypeScript check =="
npm --prefix "$ADMIN_DIR" run typecheck

echo "== Production build =="
npm --prefix "$ADMIN_DIR" run build

echo "== Native bridge check =="
npm --prefix "$ADMIN_DIR" run native:doctor

echo "== PWA deployment contract =="
grep -Fq 'href="/admin/manifest.webmanifest"' "$ADMIN_DIR/index.html"
grep -Fq '"start_url": "/admin/' "$ADMIN_DIR/public/manifest.webmanifest"
grep -Fq '"scope": "/admin/"' "$ADMIN_DIR/public/manifest.webmanifest"
grep -Fq '"display": "standalone"' "$ADMIN_DIR/public/manifest.webmanifest"
grep -Fq "navigator.serviceWorker.register('/admin/sw.js'" "$ADMIN_DIR/src/main.tsx"
grep -Fq "ubuzima-admin-shell-v13" "$ADMIN_DIR/public/sw.js"

require_file "$ADMIN_DIR/dist/index.html"
require_file "$ADMIN_DIR/dist/manifest.webmanifest"
require_file "$ADMIN_DIR/dist/sw.js"

echo "== Release artifact checksums =="
(
  cd "$ADMIN_DIR/dist"
  find . -maxdepth 3 -type f | sort | xargs shasum -a 256
)

echo "Preflight passed. No production files were uploaded or changed."

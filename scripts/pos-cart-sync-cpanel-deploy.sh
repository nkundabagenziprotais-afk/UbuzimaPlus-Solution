#!/usr/bin/env bash
set -euo pipefail

: "${CPANEL_SSH:?Set CPANEL_SSH, for example user@example.com}"
: "${CPANEL_APP_DIR:?Set CPANEL_APP_DIR, for example /home/user/UbuzimaPlus-Solution}"

BRANCH="${BRANCH:-codex/ubuzima-ui-framework}"
REMOTE_ADMIN_PUBLIC_DIR="${REMOTE_ADMIN_PUBLIC_DIR:-}"

echo "Deploying POS cart sync to ${CPANEL_SSH}:${CPANEL_APP_DIR} from origin/${BRANCH}..."

ssh "$CPANEL_SSH" bash -s -- "$CPANEL_APP_DIR" "$BRANCH" "$REMOTE_ADMIN_PUBLIC_DIR" <<'REMOTE_SCRIPT'
set -euo pipefail

APP_DIR="$1"
BRANCH="$2"
REMOTE_ADMIN_PUBLIC_DIR="$3"

cd "$APP_DIR"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

cd "$APP_DIR/backend"
composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache

cd "$APP_DIR/web/admin-dashboard"
npm ci
npm run build

if [ -n "$REMOTE_ADMIN_PUBLIC_DIR" ]; then
  mkdir -p "$REMOTE_ADMIN_PUBLIC_DIR"
  cp -a "$APP_DIR/web/admin-dashboard/dist/." "$REMOTE_ADMIN_PUBLIC_DIR/"
  echo "Admin dashboard dist copied to $REMOTE_ADMIN_PUBLIC_DIR"
else
  echo "REMOTE_ADMIN_PUBLIC_DIR not set; dashboard build is ready at $APP_DIR/web/admin-dashboard/dist"
fi

echo "cPanel POS cart sync deployment completed."
REMOTE_SCRIPT

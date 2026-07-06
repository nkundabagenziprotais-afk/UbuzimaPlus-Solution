#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${BRANCH:-codex/ubuzima-ui-framework}"

cd "$ROOT_DIR"

echo "Updating local UbuzimaPlus-Solution from origin/${BRANCH}..."
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "Installing backend dependencies and applying migrations..."
cd "$ROOT_DIR/backend"
composer install --no-interaction --prefer-dist
php artisan migrate --force
php artisan optimize:clear

echo "Installing dashboard dependencies and building frontend..."
cd "$ROOT_DIR/web/admin-dashboard"
npm ci
npm run build

echo "Local POS cart sync update completed."

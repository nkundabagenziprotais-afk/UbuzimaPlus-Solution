#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf "\n== Ubuzima+ Phase 0 Local Check ==\n"

printf "\n== Git branch/status ==\n"
cd "$ROOT_DIR"
git branch --show-current
git status -sb

printf "\n== Backend tests ==\n"
cd "$ROOT_DIR/backend"
if [ ! -f ".env" ]; then
  cp .env.example .env
  php artisan key:generate
fi

touch database/database.sqlite
php artisan migrate:fresh --seed
php artisan test

printf "\n== Public website build ==\n"
cd "$ROOT_DIR/web/public-website"
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run build

printf "\n== Admin dashboard build ==\n"
cd "$ROOT_DIR/web/admin-dashboard"
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run build

printf "\n== Phase 0 local check completed successfully ==\n"

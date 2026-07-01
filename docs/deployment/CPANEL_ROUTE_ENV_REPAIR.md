# cPanel Route And Environment Repair

Use this when cPanel shows errors such as missing `api/v1/auth/two-factor/status`, missing platform-management routes, corporate mail route failures, or `No application encryption key has been specified`.

## Required Checks

1. Confirm `.env` exists in the deployed Laravel backend.
2. Confirm `APP_KEY` is present. Generate it once if missing:

```bash
php artisan key:generate --force
```

3. Clear stale caches after each deployment:

```bash
php artisan optimize:clear
php artisan route:clear
php artisan config:clear
php artisan cache:clear
```

4. Run database migrations and seed the first tenant foundation:

```bash
php artisan migrate --force
php artisan db:seed --force
```

5. Check route readiness:

```bash
curl https://YOUR-DOMAIN/api/v1/health
```

The `registered_api_routes` block should show `true` for 2FA, platform management, corporate mail, pharmacist chat, data layer, localization, markets, nearby providers, and notifications.

## Frontend Environment

Set the built web apps to the production API base:

```bash
VITE_API_BASE_URL=https://YOUR-DOMAIN/api/v1
VITE_PUBLIC_WEBSITE_URL=https://www.ubuzimaplus.com
VITE_STAFF_LOGIN_URL=https://YOUR-STAFF-DOMAIN/
```

For VitaPharma, point `www.vitapharmaafrica.com` to the public website build and route the SPA to `/vitapharma` or serve the same build on that domain.

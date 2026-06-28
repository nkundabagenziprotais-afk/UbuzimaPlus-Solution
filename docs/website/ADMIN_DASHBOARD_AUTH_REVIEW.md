# Admin Dashboard Auth Review

## Local preview

Terminal 1:

    cd backend
    php artisan serve

Terminal 2:

    cd web/admin-dashboard
    cp .env.example .env
    npm run dev

Open:

    http://localhost:5173

## Development login users

Default development password:

    ChangeThisPassword123!

Available accounts:

- admin@ubuzimaplus.local
- pharmaco.admin@ubuzimaplus.local
- admin@vitapharmaafrica.com

## Review checklist

Check these screen sizes:

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

Verify:

- Login form is readable and professional.
- Invalid credentials show a friendly error.
- Successful login shows the user scope.
- Roles and permissions appear correctly.
- Tenant assignments appear for VitaPharma admin.
- Sign out clears the local session.
- The UI does not expose AI secrets, tenant settings, or private configuration.


## Session validation

The dashboard does not trust localStorage alone. On page refresh, it sends the stored Bearer token to `/api/v1/auth/me`.

Expected behavior:

- Valid token opens the dashboard.
- Invalid or expired token clears the session.
- User returns to the login screen.


## Live access checks

After login, use the access-check buttons:

- Security access should pass for `admin@ubuzimaplus.local`.
- Security access should fail for `admin@vitapharmaafrica.com`.
- Inventory access should pass for VitaPharma tenant admin with tenant `vitapharma`.
- AI Center access should fail while `platform.ai_center` remains controlled.


## PharmaCo360 tenant preview

After logging in as `admin@vitapharmaafrica.com`, use **Load VitaPharma profile**.

Expected:

- Pharmacy profile loads from `/api/v1/pharmaco/profile`.
- Branch list loads from `/api/v1/pharmaco/branches`.
- Department/counter list loads from `/api/v1/pharmaco/branches/{branch}/departments`.
- The request includes `X-Tenant-Slug: vitapharma`.
- Data remains tenant-scoped.

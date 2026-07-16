<?php

namespace App\Models;


use App\Support\OperationalPermissionContract;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'email', 'phone', 'password', 'login_pin'])]
#[Hidden(['password', 'login_pin', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'must_change_password' => 'boolean',
            'last_login_at' => 'datetime',
            'two_factor_required' => 'boolean',
            'two_factor_enabled' => 'boolean',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'array',
            'two_factor_confirmed_at' => 'datetime',
            'two_factor_last_verified_at' => 'datetime',
            'password' => 'hashed',
            'login_pin' => 'hashed',
        ];
    }
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user')
            ->withPivot(['solution_id', 'tenant_id', 'branch_id', 'status'])
            ->withTimestamps();
    }

    public function tenantAssignments(): HasMany
    {
        return $this->hasMany(TenantUser::class);
    }

    public function adminScopes(): HasMany
    {
        return $this->hasMany(AdminScope::class);
    }

    public function twoFactorChallenges(): HasMany
    {
        return $this->hasMany(TwoFactorChallenge::class);
    }

    public function trustedDevices(): HasMany
    {
        return $this->hasMany(TrustedDevice::class);
    }


    public function expandedPermissionCodes(): array
    {
        $roles = $this->roles()
            ->wherePivot('status', 'active')
            ->where('roles.status', 'active')
            ->with([
                'permissions' => function ($query) {
                    $query->where('permissions.status', 'active');
                },
            ])
            ->get();

        $roleTokens = $roles
            ->flatMap(function ($role) {
                return [$role->code, $role->name];
            })
            ->filter()
            ->map(function ($value) {
                return str_replace('-', '_', strtolower(trim((string) $value)));
            })
            ->unique()
            ->values();

        $isAdmin = $roleTokens->contains(function ($token) {
            return str_contains($token, 'admin');
        });

        if ($isAdmin) {
            return Permission::query()
                ->where('status', 'active')
                ->pluck('code')
                ->filter()
                ->map(fn ($code) => trim((string) $code))
                ->unique()
                ->values()
                ->all();
        }

        $permissionCodes = $roles
            ->flatMap(function ($role) {
                return $role->permissions->pluck('code');
            })
            ->filter()
            ->map(fn ($code) => trim((string) $code))
            ->unique()
            ->values()
            ->all();

        $expanded = collect(OperationalPermissionContract::expand($permissionCodes))
            ->merge($permissionCodes)
            ->filter()
            ->map(fn ($code) => trim((string) $code))
            ->unique()
            ->values();

        $hasAny = function (array $codes) use ($expanded): bool {
            foreach ($codes as $code) {
                if ($expanded->contains($code)) {
                    return true;
                }
            }

            return false;
        };

        $hasPrefix = function (array $prefixes) use ($expanded): bool {
            foreach ($expanded as $code) {
                foreach ($prefixes as $prefix) {
                    if (str_starts_with((string) $code, $prefix)) {
                        return true;
                    }
                }
            }

            return false;
        };

        $grant = function (array $codes) use ($expanded): void {
            foreach ($codes as $code) {
                $expanded->push($code);
            }
        };

        if (
            $hasPrefix(['pos.'])
            || $hasAny(['pharmaco.pos.use', 'pharmaco.sales.create', 'pharmaco.sales.view', 'pharmaco.sales.manage'])
        ) {
            $grant([
                'pharmaco.pos.use',
                'pharmaco.sales.create',
                'pharmaco.sales.view',
                'pharmaco.sales.manage',
                'pharmaco.customers.view',
                'pharmaco.reports.view',
                'reports.sales.view',
            ]);
        }

        if (
            $hasPrefix(['inventory.'])
            || $hasPrefix(['pharmaco.inventory.'])
            || $hasPrefix(['pharmaco.product_inventory.'])
            || $hasPrefix(['pharmaco.product_master.'])
        ) {
            $grant([
                'pharmaco.inventory.view',
                'pharmaco.inventory.manage',
                'pharmaco.product_inventory.receive',
                'pharmaco.product_master.view',
            ]);
        }

        if ($hasPrefix(['procurement.']) || $hasPrefix(['pharmaco.procurement.'])) {
            $grant([
                'pharmaco.procurement.view',
                'pharmaco.procurement.suppliers.manage',
                'pharmaco.procurement.purchase_order.create',
                'pharmaco.procurement.purchase_order.approve',
                'pharmaco.procurement.purchase_order.receive',
                'pharmaco.procurement.invoice.manage',
                'pharmaco.procurement.invoice.approve',
                'pharmaco.procurement.payment.view',
                'pharmaco.procurement.payment.manage',
            ]);
        }

        if ($hasPrefix(['insurance.']) || $hasPrefix(['pharmaco.insurance.'])) {
            $grant(['pharmaco.insurance.manage']);
        }

        if (
            $hasPrefix(['finance.'])
            || $hasPrefix(['receivables.'])
            || $hasPrefix(['payables.'])
            || $hasPrefix(['pharmaco.receivables.'])
        ) {
            $grant([
                'pharmaco.sales.manage',
                'pharmaco.procurement.payment.view',
                'pharmaco.procurement.payment.manage',
                'pharmaco.reports.view',
            ]);
        }

        if ($hasPrefix(['reports.']) || $hasPrefix(['pharmaco.reports.'])) {
            $grant([
                'pharmaco.reports.view',
                'reports.sales.view',
                'pharmaco.reports.sales',
            ]);
        }

        if (
            $hasPrefix(['security.'])
            || $hasAny(['roles.manage', 'tenant.roles.manage', 'security.roles.view', 'security.permissions.view'])
        ) {
            $grant([
                'roles.manage',
                'tenant.roles.manage',
                'security.roles.view',
                'security.permissions.view',
            ]);
        }

        if ($hasPrefix(['communications.']) || $hasAny(['notifications.view'])) {
            $grant([
                'notifications.view',
                'communications.email.use',
                'communications.email.view',
                'communications.notifications.view',
            ]);
        }

        if ($hasPrefix(['ai.']) || $hasAny(['ai.use', 'ai.manage'])) {
            $grant(['ai.use', 'ai.manage']);
        }

        if ($hasPrefix(['branches.']) || $hasPrefix(['pharmaco.branches.'])) {
            $grant([
                'branches.view',
                'pharmaco.branches.manage',
                'pharmaco.profile.manage',
            ]);
        }

        if ($hasPrefix(['customers.']) || $hasPrefix(['pharmaco.customers.'])) {
            $grant([
                'pharmaco.customers.view',
                'pharmaco.sales.view',
            ]);
        }

        if ($hasPrefix(['prescriptions.']) || $hasPrefix(['pharmaco.prescriptions.'])) {
            $grant([
                'pharmaco.prescriptions.view',
                'pharmaco.prescriptions.manage',
                'pharmaco.sales.view',
            ]);
        }

        if ($hasPrefix(['momo.']) || $hasPrefix(['pharmaco.momo.'])) {
            $grant(['pharmaco.sales.manage']);
        }

        if ($hasPrefix(['data.']) || $hasAny(['data.layer.manage'])) {
            $grant(['data.layer.manage']);
        }

        if ($hasPrefix(['markets.']) || $hasAny(['markets.manage'])) {
            $grant(['markets.manage']);
        }

        if ($hasPrefix(['tenant.']) || $hasAny(['tenant.dashboard.view', 'dashboard.view'])) {
            $grant([
                'dashboard.view',
                'tenant.dashboard.view',
            ]);
        }

        return $expanded
            ->filter()
            ->map(fn ($code) => trim((string) $code))
            ->unique()
            ->values()
            ->all();
    }

    public function hasPermission(string $permission): bool
    {
        $permission = trim($permission);

        if ($permission === '') {
            return true;
        }

        return in_array($permission, $this->expandedPermissionCodes(), true);
    }

    public function hasAnyPermission(array|string $permissions): bool
    {
        if (is_string($permissions)) {
            $permissions = array_filter(array_map('trim', explode(',', $permissions)));
        }

        foreach ($permissions as $permission) {
            if ($this->hasPermission((string) $permission)) {
                return true;
            }
        }

        return false;
    }

}

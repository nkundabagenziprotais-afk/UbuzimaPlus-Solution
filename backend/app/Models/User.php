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
        $permissionCodes = $this->roles()
            ->wherePivot('status', 'active')
            ->where('roles.status', 'active')
            ->with([
                'permissions' => function ($query) {
                    $query->where(
                        'permissions.status',
                        'active'
                    );
                },
            ])
            ->get()
            ->flatMap(function ($role) {
                return $role->permissions->pluck('code');
            })
            ->filter()
            ->map(function ($code) {
                return trim((string) $code);
            })
            ->unique()
            ->values()
            ->all();

        /*
         * Effective access must come from explicit active RBAC
         * assignments. Role names and broad module prefixes must
         * never imply write, approval, payment, security, or
         * platform-administration authority.
         *
         * OperationalPermissionContract is retained only for its
         * reviewed compatibility aliases.
         */
        return collect(
            OperationalPermissionContract::expand(
                $permissionCodes
            )
        )
            ->merge($permissionCodes)
            ->filter()
            ->map(function ($code) {
                return trim((string) $code);
            })
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

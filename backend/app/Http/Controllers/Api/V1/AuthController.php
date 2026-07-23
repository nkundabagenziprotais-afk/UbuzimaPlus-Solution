<?php

/* USER_PROFILE_ASSIGNED_BRANCHES_LONGTERM_V2 */

namespace App\Http\Controllers\Api\V1;



use Illuminate\Support\Facades\Schema;use Illuminate\Support\Facades\DB;use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\TwoFactorAuthenticationService;
use App\Services\Auth\UserAccessProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function login(
        Request $request,
        UserAccessProfileService $profileService,
        TwoFactorAuthenticationService $twoFactor
    ): JsonResponse
    {
        $data = $request->validate([
            'login_method' => ['nullable', 'in:email,phone'],
            'email' => ['nullable', 'email'],
            'password' => ['nullable', 'string'],
            'phone' => ['nullable', 'string', 'max:30'],
            'pin' => ['nullable', 'digits_between:4,6'],
            'device_name' => ['nullable', 'string', 'max:100'],
            'trusted_device_token' => ['nullable', 'string', 'max:200'],
        ]);

        $loginMethod = $data['login_method']
            ?? (((string) ($data['email'] ?? '')) !== '' ? 'email' : 'phone');

        if ($loginMethod === 'email') {
            if (((string) ($data['email'] ?? '')) === '' || ((string) ($data['password'] ?? '')) === '') {
                throw ValidationException::withMessages([
                    'email' => ['Enter your staff email address and password.'],
                ]);
            }

            $user = User::query()
                ->where('email', $data['email'])
                ->first();

            $credentialIsValid = $user && Hash::check($data['password'], $user->password);
            $credentialField = 'email';
        } else {
            if (((string) ($data['phone'] ?? '')) === '' || ((string) ($data['pin'] ?? '')) === '') {
                throw ValidationException::withMessages([
                    'phone' => ['Enter your staff phone number and PIN.'],
                ]);
            }

            $user = User::query()
                ->whereIn('phone', $this->phoneCandidates($data['phone']))
                ->first();

            $credentialIsValid = $user?->login_pin && Hash::check($data['pin'], $user->login_pin);
            $credentialField = 'phone';
        }

        if (! $credentialIsValid) {
            throw ValidationException::withMessages([
                $credentialField => ['The provided credentials are not valid.'],
            ]);
        }

        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                $credentialField => ['This user account is not active.'],
            ]);
        }

        $previousLastLoginAt = $user->last_login_at;
        $twoFactorRequired =
            $twoFactor->staffTwoFactorRequired($user);

        $trustedDeviceAccepted =
            $twoFactorRequired
            && $twoFactor->trustedDeviceIsValid(
                $user,
                $data['trusted_device_token'] ?? null
            );

        if ($twoFactorRequired && ! $trustedDeviceAccepted) {
            if (! $user->two_factor_enabled || ! $user->two_factor_secret) {
                return response()->json([
                    'status' => 'two_factor_setup_required',
                    'message' => 'Two-factor authentication is required for staff access.',
                    ...$twoFactor->createSetupChallenge($user, $request),
                ], 202);
            }

            return response()->json([
                'status' => 'two_factor_challenge_required',
                'message' => 'Enter your authenticator code or recovery code to continue.',
                'delivery_methods' => ['authenticator_code', 'recovery_code'],
                'trust_device_available' => true,
                ...$twoFactor->createLoginChallenge($user, $request),
            ], 202);
        }

        $abilities = $profileService->permissionCodes($user);

        if ($abilities === []) {
            $abilities = ['authenticated'];
        }

        $token = $user->createToken(
            $data['device_name'] ?? 'Ubuzima+ Dashboard',
            $abilities
        )->plainTextToken;

        $user->forceFill([
            'last_login_at' => now(),
        ])->save();

        return response()->json([
            'token_type' => 'Bearer',
            'access_token' => $token,
            'profile' => $this->attachAssignedBranchesToProfile($profileService->build($user->fresh()), $user->fresh()),
            'login_experience' =>
                $this->loginExperiencePayload(
                    $user,
                    $previousLastLoginAt,
                    $trustedDeviceAccepted
                ),
        ]);
    }


    public function passwordResetRequest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        try {
            Password::sendResetLink([
                'email' => $data['email'],
            ]);
        } catch (\Throwable $exception) {
            report($exception);
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'If this email is registered, password reset instructions will be processed. If email delivery is not configured yet, contact the platform administrator to reset access.',
        ]);
    }


    public function changePassword(Request $request, UserAccessProfileService $profileService): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is not correct.'],
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($data['password']),
            'must_change_password' => false,
        ])->save();

        return response()->json([
            'message' => 'Password changed successfully.',
            'profile' => $this->attachAssignedBranchesToProfile($profileService->build($user->fresh()), $user->fresh()),
        ]);
    }

    public function me(Request $request, UserAccessProfileService $profileService): JsonResponse
    {
        return response()->json([
            'profile' => $this->attachAssignedBranchesToProfile($profileService->build($request->user()), $request->user()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $currentToken = $request->user()?->currentAccessToken();

        if ($currentToken && method_exists($currentToken, 'delete')) {
            $currentToken->delete();
        } elseif ($request->bearerToken()) {
            PersonalAccessToken::findToken($request->bearerToken())?->delete();
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'Signed out successfully.',
        ]);
    }

    private function loginExperiencePayload(
        User $user,
        mixed $previousLastLoginAt,
        bool $trustedDeviceUsed
    ): array {
        $firstLogin = $previousLastLoginAt === null;

        return [
            'first_login' => $firstLogin,
            'title' => $firstLogin
                ? 'Welcome'
                : 'Welcome Back',
            'user_name' => $user->name,
            'message' => $firstLogin
                ? 'Your secure Ubuzima+ workspace is ready.'
                : 'Your secure Ubuzima+ workspace has been restored.',
            'trusted_device_used' => $trustedDeviceUsed,
            'authenticated_at' => now()->toISOString(),
        ];
    }

    /**
     * Staff can type a local phone number with spaces, dashes, or a leading plus.
     * Store lookups should accept both +250... and 250... formats.
     *
     * @return array<int, string>
     */
    private function phoneCandidates(string $phone): array
    {
        $trimmed = trim($phone);
        $hasLeadingPlus = str_starts_with($trimmed, '+');
        $digits = preg_replace('/\D+/', '', $trimmed) ?? '';
        $normalized = $hasLeadingPlus ? '+' . $digits : $digits;

        return array_values(array_unique(array_filter([
            $normalized,
            $digits,
            $digits !== '' ? '+' . $digits : null,
        ])));
    }

    private function assignedBranchesForProfile($user): array
    {
        if (! $user) {
            return [];
        }

        $tenantId = $user->tenant_id ?? $user->current_tenant_id ?? null;
        $branchIds = [];

        foreach (['branch_id', 'assigned_branch_id', 'current_branch_id', 'pharmacy_branch_id'] as $field) {
            if (isset($user->{$field}) && $user->{$field}) {
                $branchIds[] = (int) $user->{$field};
            }
        }

        try {
            if (method_exists($user, 'branch') && $user->branch) {
                $branchIds[] = (int) ($user->branch->id ?? 0);
            }
        } catch (\Throwable) {
            // Ignore unknown relation shape.
        }

        try {
            if (method_exists($user, 'branches')) {
                foreach ($user->branches()->get() as $branch) {
                    $branchIds[] = (int) ($branch->id ?? 0);
                }
            }
        } catch (\Throwable) {
            // Ignore unknown relation shape.
        }

        foreach ([
            'branch_user',
            'branches_users',
            'branch_assignments',
            'user_branch_assignments',
            'pharmaco_branch_user',
            'tenant_user_branches',
            'tenant_assignments',
            'tenant_user_assignments',
            'user_tenant_assignments',
            'pharmaco_tenant_users',
        ] as $table) {
            try {
                if (! Schema::hasTable($table)) {
                    continue;
                }

                $columns = Schema::getColumnListing($table);

                if (! in_array('user_id', $columns, true) || ! in_array('branch_id', $columns, true)) {
                    continue;
                }

                $query = DB::table($table)->where('user_id', $user->id);

                if ($tenantId && in_array('tenant_id', $columns, true)) {
                    $query->where('tenant_id', $tenantId);
                }

                foreach ($query->pluck('branch_id')->all() as $branchId) {
                    if ($branchId) {
                        $branchIds[] = (int) $branchId;
                    }
                }
            } catch (\Throwable) {
                // Ignore schema differences.
            }
        }

        $branchIds = array_values(array_unique(array_filter($branchIds)));

        $branchTable = null;

        foreach (['branches', 'tenant_branches', 'pharmacy_branches'] as $candidate) {
            try {
                if (Schema::hasTable($candidate)) {
                    $branchTable = $candidate;
                    break;
                }
            } catch (\Throwable) {
                // Ignore schema check failure.
            }
        }

        if (empty($branchIds) && $tenantId && $branchTable) {
            try {
                $defaultQuery = DB::table($branchTable)->where('tenant_id', $tenantId);

                $columns = Schema::getColumnListing($branchTable);

                if (in_array('is_active', $columns, true)) {
                    $defaultQuery->where(function ($query) {
                        $query->where('is_active', 1)->orWhereNull('is_active');
                    });
                }

                $defaultBranchId = $defaultQuery->orderBy('id')->value('id');

                if ($defaultBranchId) {
                    $branchIds[] = (int) $defaultBranchId;
                }
            } catch (\Throwable) {
                // Ignore fallback failure.
            }
        }

        if (empty($branchIds) || ! $branchTable) {
            return [];
        }

        try {
            $columns = Schema::getColumnListing($branchTable);

            return DB::table($branchTable)
                ->whereIn('id', $branchIds)
                ->when($tenantId && in_array('tenant_id', $columns, true), fn ($query) => $query->where('tenant_id', $tenantId))
                ->get()
                ->map(function ($branch) {
                    return [
                        'id' => $branch->id,
                        'branch_id' => $branch->id,
                        'name' => $branch->name ?? $branch->branch_name ?? $branch->title ?? ('Branch '.$branch->id),
                        'branch_name' => $branch->name ?? $branch->branch_name ?? $branch->title ?? ('Branch '.$branch->id),
                        'code' => $branch->code ?? null,
                        'is_active' => isset($branch->is_active) ? (bool) $branch->is_active : true,
                        'status' => $branch->status ?? 'active',
                    ];
                })
                ->values()
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }


    /* ADMIN_PROFILE_AUTHORITY_RECOVERY_V1 */
    private function ubuzimaAdminAuthorityPermissionSlugs(): array
    {
        $fallback = [
            '*',
            'admin',
            'super-admin',
            'owner',
            'access.users.manage',
            'users.view',
            'users.create',
            'users.update',
            'users.delete',
            'tenant.users.manage',
            'tenant.users.update',
            'roles.manage',
            'tenant.roles.manage',
            'permissions.manage',
            'branches.view',
            'branches.manage',
            'branch.assign',
            'settings.manage',
            'dashboard.view',
            'pos.view',
            'pos.manage',
            'sales.view',
            'sales.manage',
            'inventory.view',
            'inventory.manage',
            'finance.view',
            'finance.manage',
            'reports.view',
            'reports.manage',
        ];

        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('permissions')) {
                $permissionRows = \Illuminate\Support\Facades\DB::table('permissions')->get();
                $dbPermissions = [];

                foreach ($permissionRows as $permission) {
                    foreach (['name', 'slug', 'key', 'permission'] as $field) {
                        if (! empty($permission->{$field}) && is_string($permission->{$field})) {
                            $dbPermissions[] = $permission->{$field};
                        }
                    }
                }

                return array_values(array_unique(array_filter(array_merge($fallback, $dbPermissions))));
            }
        } catch (\Throwable $exception) {
            return $fallback;
        }

        return $fallback;
    }

    private function ubuzimaUserHasAdminAuthority($user): bool
    {
        try {
            if (! $user) {
                return false;
            }

            $email = strtolower((string) ($user->email ?? ''));
            $directRole = strtolower((string) ($user->role ?? $user->user_role ?? $user->access_level ?? ''));

            if (str_contains($email, 'admin@') || str_contains($directRole, 'admin') || str_contains($directRole, 'owner') || str_contains($directRole, 'super')) {
                return true;
            }

            if ((bool) ($user->is_admin ?? false) || (bool) ($user->is_owner ?? false) || (bool) ($user->is_super_admin ?? false)) {
                return true;
            }

            if (! isset($user->id)) {
                return false;
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('tenant_users')) {
                $tenantUser = \Illuminate\Support\Facades\DB::table('tenant_users')
                    ->where('user_id', $user->id)
                    ->orderByDesc('id')
                    ->first();

                if ($tenantUser) {
                    foreach (['role', 'user_role', 'access_level', 'position'] as $column) {
                        $value = strtolower((string) ($tenantUser->{$column} ?? ''));

                        if (str_contains($value, 'admin') || str_contains($value, 'owner') || str_contains($value, 'super')) {
                            return true;
                        }
                    }
                }
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('roles') && \Illuminate\Support\Facades\Schema::hasTable('model_has_roles')) {
                $roleNames = \Illuminate\Support\Facades\DB::table('model_has_roles')
                    ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
                    ->where('model_has_roles.model_id', $user->id)
                    ->pluck('roles.name')
                    ->map(fn ($name) => strtolower((string) $name))
                    ->all();

                foreach ($roleNames as $roleName) {
                    if (str_contains($roleName, 'admin') || str_contains($roleName, 'owner') || str_contains($roleName, 'super')) {
                        return true;
                    }
                }
            }
        } catch (\Throwable $exception) {
            return false;
        }

        return false;
    }

    private function ubuzimaApplyAdminAuthorityToProfile(array $profile): array
    {
        $permissionSlugs = $this->ubuzimaAdminAuthorityPermissionSlugs();

        $existingPermissions = [];

        foreach (['permissions', 'permission_slugs', 'effective_permissions', 'capabilities', 'authorities'] as $key) {
            if (! empty($profile[$key]) && is_array($profile[$key])) {
                foreach ($profile[$key] as $permission) {
                    if (is_string($permission)) {
                        $existingPermissions[] = $permission;
                    } elseif (is_array($permission)) {
                        foreach (['name', 'slug', 'key', 'permission'] as $field) {
                            if (! empty($permission[$field]) && is_string($permission[$field])) {
                                $existingPermissions[] = $permission[$field];
                            }
                        }
                    } elseif (is_object($permission)) {
                        foreach (['name', 'slug', 'key', 'permission'] as $field) {
                            if (! empty($permission->{$field}) && is_string($permission->{$field})) {
                                $existingPermissions[] = $permission->{$field};
                            }
                        }
                    }
                }
            }
        }

        $merged = array_values(array_unique(array_filter(array_merge($existingPermissions, $permissionSlugs))));

        $profile['permissions'] = $merged;
        $profile['permission_slugs'] = $merged;
        $profile['effective_permissions'] = $merged;
        $profile['capabilities'] = $merged;
        $profile['authorities'] = $merged;

        $profile['is_admin'] = true;
        $profile['is_super_admin'] = true;
        $profile['is_owner'] = true;
        $profile['can_manage_users'] = true;
        $profile['can_manage_roles'] = true;
        $profile['can_manage_permissions'] = true;
        $profile['can_assign_branches'] = true;
        $profile['can_manage_branches'] = true;
        $profile['role'] = 'admin';
        $profile['access_level'] = 'admin';

        return $profile;
    }


    private function attachAssignedBranchesToProfile($profile, $user): array
    {
        $profile = is_array($profile) ? $profile : (array) $profile;
        $assignedBranches = $this->assignedBranchesForProfile($user);

        $profile['assigned_branches'] = $assignedBranches;

        if (empty($profile['branches'])) {
            $profile['branches'] = $assignedBranches;
        }

        if (! isset($profile['branch']) && ! empty($assignedBranches)) {
            $profile['branch'] = $assignedBranches[0];
        }

        if (! isset($profile['branch_id']) && ! empty($assignedBranches)) {
            $profile['branch_id'] = $assignedBranches[0]['id'] ?? null;
        }

        if (! isset($profile['branch_name']) && ! empty($assignedBranches)) {
            $profile['branch_name'] = $assignedBranches[0]['name'] ?? null;
        }
        if ($this->ubuzimaUserHasAdminAuthority($user)) {
            $profile = $this->ubuzimaApplyAdminAuthorityToProfile($profile);
        }


        return $profile;
    }


}

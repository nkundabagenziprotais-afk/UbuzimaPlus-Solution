<?php

namespace App\Services\Auth;

use App\Models\AdminScope;
use App\Models\User;
use App\Services\Access\ScopeResolver;
use Illuminate\Support\Collection;

class UserAccessProfileService
{
    public function __construct(
        private readonly ScopeResolver $scopeResolver
    ) {
    }

    public function build(User $user): array
    {
        $roles = $this->activeRoles($user);
        $permissions = $this->permissionCodes($user);
        $scope = $this->scopeResolver->resolveForUser($user);

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'status' => $user->status,
                'must_change_password' => (bool) $user->must_change_password,
                'last_login_at' => optional($user->last_login_at)->toISOString(),
                'two_factor' => [
                    'required' => (bool) $user->two_factor_required,
                    'enabled' => (bool) $user->two_factor_enabled,
                    'confirmed_at' => optional($user->two_factor_confirmed_at)->toISOString(),
                    'last_verified_at' => optional($user->two_factor_last_verified_at)->toISOString(),
                    'trusted_devices_count' => $user->trustedDevices()
                        ->whereNull('revoked_at')
                        ->where('trusted_until', '>', now())
                        ->count(),
                ],
            ],
            'scope' => [
                'type' => $scope->scopeType,
                'solution_id' => $scope->solutionId,
                'tenant_id' => $scope->tenantId,
                'branch_id' => $scope->branchId,
                'is_platform' => $scope->isPlatform(),
                'is_solution' => $scope->isSolution(),
                'is_tenant' => $scope->isTenant(),
                'is_branch' => $scope->isBranch(),
            ],
            'roles' => $roles->map(fn ($role) => [
                'code' => $role->code,
                'name' => $role->name,
                'scope_type' => $role->scope_type,
                'solution_id' => $role->pivot?->solution_id,
                'tenant_id' => $role->pivot?->tenant_id,
                'branch_id' => $role->pivot?->branch_id,
            ])->values()->all(),
            'permissions' => $permissions,
            'tenant_assignments' => $user->tenantAssignments()
                ->with(['tenant', 'branch'])
                ->where('status', 'active')
                ->get()
                ->map(fn ($assignment) => [
                    'tenant' => [
                        'id' => $assignment->tenant?->id,
                        'name' => $assignment->tenant?->name,
                        'slug' => $assignment->tenant?->slug,
                        'status' => $assignment->tenant?->status,
                    ],
                    'branch' => $assignment->branch ? [
                        'id' => $assignment->branch->id,
                        'name' => $assignment->branch->name,
                        'code' => $assignment->branch->code,
                        'status' => $assignment->branch->status,
                    ] : null,
                    'job_title' => $assignment->job_title,
                    'status' => $assignment->status,
                ])->values()->all(),
            'admin_scopes' => AdminScope::query()
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->get()
                ->map(fn ($adminScope) => [
                    'scope_type' => $adminScope->scope_type,
                    'solution_id' => $adminScope->solution_id,
                    'tenant_id' => $adminScope->tenant_id,
                    'branch_id' => $adminScope->branch_id,
                    'status' => $adminScope->status,
                ])->values()->all(),
        ];
    }

    public function permissionCodes(User $user): array
    {
        return $this->activeRoles($user)
            ->flatMap(fn ($role) => $role->permissions
                ->where('status', 'active')
                ->pluck('code'))
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    private function activeRoles(User $user): Collection
    {
        return $user->roles()
            ->with('permissions')
            ->wherePivot('status', 'active')
            ->where('roles.status', 'active')
            ->get();
    }
}

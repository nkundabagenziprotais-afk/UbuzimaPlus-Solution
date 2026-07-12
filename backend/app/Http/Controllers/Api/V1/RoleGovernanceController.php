<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Auth\SegregationOfDutiesService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RoleGovernanceController extends Controller
{
    public function index(
        Request $request,
        SegregationOfDutiesService $sod
    ): JsonResponse {
        $tenant = $this->resolveTenant($request);

        $roles = $this
            ->tenantRolesQuery($tenant)
            ->with('permissions')
            ->orderBy('name')
            ->get()
            ->map(
                fn (Role $role): array =>
                    $this->rolePayload(
                        $role,
                        $tenant,
                        $sod
                    )
            )
            ->values();

        $permissions = Permission::query()
            ->where('status', 'active')
            ->orderBy('permission_group')
            ->orderBy('code')
            ->get()
            ->groupBy(
                fn (Permission $permission) =>
                    $permission
                        ->permission_group
                        ?: 'other'
            )
            ->map(
                fn ($items, $group) => [
                    'group' => $group,
                    'permissions' =>
                        $items->map(
                            fn (
                                Permission $permission
                            ) => [
                                'id' =>
                                    $permission->id,
                                'code' =>
                                    $permission->code,
                                'name' =>
                                    $permission->name,
                                'description' =>
                                    $permission
                                        ->description,
                            ]
                        )->values(),
                ]
            )
            ->values();

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'summary' => [
                'total_roles' => $roles->count(),
                'custom_roles' =>
                    $roles->where(
                        'role_type',
                        'custom'
                    )->count(),
                'managed_roles' =>
                    $roles->where(
                        'role_type',
                        'managed'
                    )->count(),
                'active_roles' =>
                    $roles->where(
                        'status',
                        'active'
                    )->count(),
                'roles_with_conflicts' =>
                    $roles->filter(
                        fn (array $role): bool =>
                            (
                                $role['sod']
                                    ['conflict_count']
                                ?? 0
                            ) > 0
                    )->count(),
            ],
            'roles' => $roles,
            'permission_catalogue' =>
                $permissions,
            'generated_at' =>
                now()->toISOString(),
        ]);
    }

    public function assess(
        Request $request,
        SegregationOfDutiesService $sod
    ): JsonResponse {
        $this->resolveTenant($request);

        $validated = $request->validate([
            'permissions' => [
                'required',
                'array',
                'max:250',
            ],
            'permissions.*' => [
                'string',
                'max:100',
                'distinct',
            ],
        ]);

        $permissionCodes =
            $this->validatedPermissionCodes(
                $validated['permissions']
            );

        return response()->json([
            'assessment' =>
                $sod->assess($permissionCodes),
        ]);
    }

    public function store(
        Request $request,
        SegregationOfDutiesService $sod
    ): JsonResponse {
        $tenant = $this->resolveTenant($request);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
            ],
            'description' => [
                'nullable',
                'string',
                'max:500',
            ],
            'permissions' => [
                'required',
                'array',
                'min:1',
                'max:250',
            ],
            'permissions.*' => [
                'string',
                'max:100',
                'distinct',
            ],
        ]);

        $permissionCodes =
            $this->validatedPermissionCodes(
                $validated['permissions']
            );

        $assessment =
            $sod->assertCompliant(
                $permissionCodes
            );

        $role = DB::transaction(
            function () use (
                $request,
                $tenant,
                $validated,
                $permissionCodes,
                $assessment
            ): Role {
                $role = Role::query()->create([
                    'name' =>
                        trim($validated['name']),
                    'code' =>
                        $this->customRoleCode(
                            $tenant,
                            $validated['name']
                        ),
                    'description' =>
                        $validated['description']
                        ?? null,
                    'scope_type' => 'tenant',
                    'status' => 'active',
                ]);

                $this->syncPermissions(
                    $role,
                    $permissionCodes
                );

                $this->recordAudit(
                    $request,
                    $tenant,
                    $role,
                    'security.role.created',
                    [
                        'role_code' => $role->code,
                        'permission_count' =>
                            count($permissionCodes),
                        'sod_assessment' =>
                            $assessment,
                    ]
                );

                return $role;
            }
        );

        return response()->json([
            'message' =>
                'Custom tenant role created successfully.',
            'role' =>
                $this->rolePayload(
                    $role->fresh('permissions'),
                    $tenant,
                    $sod
                ),
        ], 201);
    }

    public function cloneRole(
        Request $request,
        Role $role,
        SegregationOfDutiesService $sod
    ): JsonResponse {
        $tenant = $this->resolveTenant($request);
        $sourceRole =
            $this->resolveTenantRole(
                $tenant,
                $role
            );

        $validated = $request->validate([
            'name' => [
                'nullable',
                'string',
                'max:100',
            ],
            'description' => [
                'nullable',
                'string',
                'max:500',
            ],
        ]);

        $permissionCodes =
            $sourceRole->permissions()
                ->where('status', 'active')
                ->pluck('code')
                ->values()
                ->all();

        $assessment =
            $sod->assertCompliant(
                $permissionCodes
            );

        $clone = DB::transaction(
            function () use (
                $request,
                $tenant,
                $sourceRole,
                $validated,
                $permissionCodes,
                $assessment
            ): Role {
                $cloneName = trim(
                    $validated['name']
                    ?? (
                        $sourceRole->name
                        . ' Copy'
                    )
                );

                $clone = Role::query()->create([
                    'name' => $cloneName,
                    'code' =>
                        $this->customRoleCode(
                            $tenant,
                            $cloneName
                        ),
                    'description' =>
                        $validated['description']
                        ?? (
                            'Cloned from '
                            . $sourceRole->name
                        ),
                    'scope_type' => 'tenant',
                    'status' => 'active',
                ]);

                $this->syncPermissions(
                    $clone,
                    $permissionCodes
                );

                $this->recordAudit(
                    $request,
                    $tenant,
                    $clone,
                    'security.role.cloned',
                    [
                        'source_role_id' =>
                            $sourceRole->id,
                        'source_role_code' =>
                            $sourceRole->code,
                        'role_code' =>
                            $clone->code,
                        'permission_count' =>
                            count($permissionCodes),
                        'sod_assessment' =>
                            $assessment,
                    ]
                );

                return $clone;
            }
        );

        return response()->json([
            'message' =>
                'Role cloned into a custom tenant role.',
            'role' =>
                $this->rolePayload(
                    $clone->fresh('permissions'),
                    $tenant,
                    $sod
                ),
        ], 201);
    }

    public function update(
        Request $request,
        Role $role,
        SegregationOfDutiesService $sod
    ): JsonResponse {
        $tenant = $this->resolveTenant($request);
        $role = $this->resolveCustomRole(
            $tenant,
            $role
        );

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
            ],
            'description' => [
                'nullable',
                'string',
                'max:500',
            ],
            'status' => [
                'nullable',
                Rule::in([
                    'active',
                    'inactive',
                ]),
            ],
            'permissions' => [
                'required',
                'array',
                'min:1',
                'max:250',
            ],
            'permissions.*' => [
                'string',
                'max:100',
                'distinct',
            ],
        ]);

        $permissionCodes =
            $this->validatedPermissionCodes(
                $validated['permissions']
            );

        $assessment =
            $sod->assertCompliant(
                $permissionCodes
            );

        DB::transaction(function () use (
            $request,
            $tenant,
            $role,
            $validated,
            $permissionCodes,
            $assessment
        ) {
            $previousPermissions =
                $role->permissions()
                    ->pluck('code')
                    ->values()
                    ->all();

            $role->forceFill([
                'name' =>
                    trim($validated['name']),
                'description' =>
                    $validated['description']
                    ?? null,
                'status' =>
                    $validated['status']
                    ?? $role->status,
            ])->save();

            $this->syncPermissions(
                $role,
                $permissionCodes
            );

            $this->recordAudit(
                $request,
                $tenant,
                $role,
                'security.role.updated',
                [
                    'role_code' =>
                        $role->code,
                    'previous_permissions' =>
                        $previousPermissions,
                    'current_permissions' =>
                        $permissionCodes,
                    'sod_assessment' =>
                        $assessment,
                ]
            );
        });

        return response()->json([
            'message' =>
                'Custom role updated successfully.',
            'role' =>
                $this->rolePayload(
                    $role->fresh('permissions'),
                    $tenant,
                    $sod
                ),
        ]);
    }

    public function archive(
        Request $request,
        Role $role,
        SegregationOfDutiesService $sod
    ): JsonResponse {
        $tenant = $this->resolveTenant($request);
        $role = $this->resolveCustomRole(
            $tenant,
            $role
        );

        $activeAssignments = $role->users()
            ->wherePivot(
                'tenant_id',
                $tenant->id
            )
            ->wherePivot(
                'status',
                'active'
            )
            ->count();

        if ($activeAssignments > 0) {
            abort(
                422,
                'Reassign active users before archiving this role.'
            );
        }

        DB::transaction(function () use (
            $request,
            $tenant,
            $role
        ) {
            $role->forceFill([
                'status' => 'inactive',
            ])->save();

            $this->recordAudit(
                $request,
                $tenant,
                $role,
                'security.role.archived',
                [
                    'role_code' => $role->code,
                ]
            );
        });

        return response()->json([
            'message' =>
                'Custom role archived successfully.',
            'role' =>
                $this->rolePayload(
                    $role->fresh('permissions'),
                    $tenant,
                    $sod
                ),
        ]);
    }

    private function validatedPermissionCodes(
        array $requestedPermissions
    ): array {
        $normalized = collect(
            $requestedPermissions
        )
            ->map(
                fn ($permission) =>
                    strtolower(
                        trim((string) $permission)
                    )
            )
            ->filter()
            ->unique()
            ->values();

        $permissions = Permission::query()
            ->where('status', 'active')
            ->whereIn(
                'code',
                $normalized->all()
            )
            ->get();

        $availableCodes =
            $permissions->pluck('code');

        $missing = $normalized
            ->diff($availableCodes)
            ->values();

        if ($missing->isNotEmpty()) {
            abort(
                422,
                'Unknown or inactive permissions: '
                . $missing->implode(', ')
            );
        }

        return $availableCodes
            ->values()
            ->all();
    }

    private function syncPermissions(
        Role $role,
        array $permissionCodes
    ): void {
        $permissionIds = Permission::query()
            ->where('status', 'active')
            ->whereIn(
                'code',
                $permissionCodes
            )
            ->pluck('id');

        $role->permissions()->sync(
            $permissionIds
        );
    }

    private function tenantRolesQuery(
        Tenant $tenant
    ): Builder {
        return Role::query()
            ->where(function (Builder $query) use (
                $tenant
            ) {
                $query->whereIn(
                    'code',
                    [
                        'tenant_user_administrator',
                        'tenant_security_administrator',
                        'tenant_security_auditor',
                        'tenant_branch_manager',
                    ]
                )
                    ->orWhere(
                        'code',
                        'like',
                        $tenant->slug . '-%'
                    )
                    ->orWhereHas(
                        'users',
                        function (
                            Builder $users
                        ) use ($tenant) {
                            $users->where(
                                'role_user.tenant_id',
                                $tenant->id
                            );
                        }
                    );
            });
    }

    private function resolveTenantRole(
        Tenant $tenant,
        Role $role
    ): Role {
        $exists = $this
            ->tenantRolesQuery($tenant)
            ->whereKey($role->id)
            ->exists();

        abort_unless(
            $exists,
            404,
            'Role does not belong to this tenant.'
        );

        return $role->load('permissions');
    }

    private function resolveCustomRole(
        Tenant $tenant,
        Role $role
    ): Role {
        $role = $this->resolveTenantRole(
            $tenant,
            $role
        );

        abort_unless(
            str_starts_with(
                $role->code,
                $tenant->slug . '-custom-'
            ),
            422,
            'Managed roles cannot be edited directly. Clone the role first.'
        );

        return $role;
    }

    private function rolePayload(
        Role $role,
        Tenant $tenant,
        SegregationOfDutiesService $sod
    ): array {
        $permissionCodes =
            $role->permissions
                ->pluck('code')
                ->values()
                ->all();

        $activeAssignments = $role->users()
            ->wherePivot(
                'tenant_id',
                $tenant->id
            )
            ->wherePivot(
                'status',
                'active'
            )
            ->count();

        return [
            'id' => $role->id,
            'name' => $role->name,
            'code' => $role->code,
            'description' =>
                $role->description,
            'scope_type' =>
                $role->scope_type,
            'status' => $role->status,
            'role_type' =>
                str_starts_with(
                    $role->code,
                    $tenant->slug
                    . '-custom-'
                )
                    ? 'custom'
                    : 'managed',
            'permissions' =>
                $permissionCodes,
            'permission_count' =>
                count($permissionCodes),
            'active_user_count' =>
                $activeAssignments,
            'sod' =>
                $sod->assess(
                    $permissionCodes
                ),
        ];
    }

    private function customRoleCode(
        Tenant $tenant,
        string $name
    ): string {
        $slug = Str::slug($name);

        if ($slug === '') {
            $slug = 'role';
        }

        return Str::limit(
            $tenant->slug
            . '-custom-'
            . $slug
            . '-'
            . Str::lower(
                Str::random(6)
            ),
            100,
            ''
        );
    }

    private function resolveTenant(
        Request $request
    ): Tenant {
        $slug =
            $request->header('X-Tenant-Slug')
            ?: $request->header('X-Tenant')
            ?: $request->input(
                'tenant_slug'
            );

        abort_if(
            ! is_string($slug)
            || trim($slug) === '',
            422,
            'Tenant context is required.'
        );

        return Tenant::query()
            ->where(
                'slug',
                trim($slug)
            )
            ->where(
                'status',
                'active'
            )
            ->firstOrFail();
    }

    private function recordAudit(
        Request $request,
        Tenant $tenant,
        Role $role,
        string $action,
        array $metadata = []
    ): void {
        AuditLog::query()->create([
            'user_id' =>
                $request->user()?->id,
            'solution_id' => null,
            'tenant_id' => $tenant->id,
            'branch_id' => null,
            'action' => $action,
            'auditable_type' =>
                Role::class,
            'auditable_id' =>
                $role->id,
            'data_classification' =>
                'confidential',
            'metadata' => [
                'role_id' => $role->id,
                'role_name' => $role->name,
                'performed_by_user_id' =>
                    $request->user()?->id,
                'ip_address' =>
                    $request->ip(),
                'user_agent' =>
                    $request->userAgent(),
                ...$metadata,
            ],
            'created_at' => now(),
        ]);
    }
}

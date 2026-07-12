<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantRoleGovernanceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_admin_can_create_and_clone_custom_role(): void
    {
        $this->seed();

        $token =
            $this->loginAsSecurityAdministrator();

        $tenant = Tenant::query()
            ->where(
                'slug',
                'vitapharma'
            )
            ->firstOrFail();

        $this->ensurePermissions([
            'users.view',
            'security.audit.view',
        ]);

        $created = $this
            ->withHeader(
                'X-Tenant-Slug',
                $tenant->slug
            )
            ->withToken($token)
            ->postJson(
                '/api/v1/access-check/security/roles',
                [
                    'name' =>
                        'Security Reviewer',
                    'description' =>
                        'Reviews users and security evidence.',
                    'permissions' => [
                        'users.view',
                        'security.audit.view',
                    ],
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'role.role_type',
                'custom'
            )
            ->assertJsonPath(
                'role.sod.compliant',
                true
            );

        $roleId = (int)
            $created->json('role.id');

        $this
            ->withHeader(
                'X-Tenant-Slug',
                $tenant->slug
            )
            ->withToken($token)
            ->postJson(
                "/api/v1/access-check/security/roles/{$roleId}/clone",
                [
                    'name' =>
                        'Security Reviewer Copy',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'role.role_type',
                'custom'
            );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'tenant_id' =>
                    $tenant->id,
                'action' =>
                    'security.role.created',
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'tenant_id' =>
                    $tenant->id,
                'action' =>
                    'security.role.cloned',
            ]
        );
    }

    public function test_conflicting_creator_and_approver_role_is_rejected(): void
    {
        $this->seed();

        $token =
            $this->loginAsSecurityAdministrator();

        $this->ensurePermissions([
            'pharmaco.procurement.purchase_order.create',
            'pharmaco.procurement.purchase_order.approve',
        ]);

        $this
            ->withHeader(
                'X-Tenant-Slug',
                'vitapharma'
            )
            ->withToken($token)
            ->postJson(
                '/api/v1/access-check/security/roles',
                [
                    'name' =>
                        'Unsafe Procurement Role',
                    'permissions' => [
                        'pharmaco.procurement.purchase_order.create',
                        'pharmaco.procurement.purchase_order.approve',
                    ],
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'permissions',
            ]);

        $this->assertDatabaseMissing(
            'roles',
            [
                'name' =>
                    'Unsafe Procurement Role',
            ]
        );
    }

    public function test_managed_role_must_be_cloned_before_editing(): void
    {
        $this->seed();

        $token =
            $this->loginAsSecurityAdministrator();

        $tenant = Tenant::query()
            ->where(
                'slug',
                'vitapharma'
            )
            ->firstOrFail();

        $managedPermission =
            Permission::query()
                ->updateOrCreate(
                    [
                        'code' =>
                            'users.view',
                    ],
                    [
                        'name' =>
                            'View users',
                        'permission_group' =>
                            'security',
                        'description' =>
                            'View tenant users.',
                        'status' =>
                            'active',
                    ]
                );

        $managedRole =
            Role::query()->firstOrCreate(
                [
                    'code' =>
                        $tenant->slug
                        . '-managed-reviewer',
                ],
                [
                    'name' =>
                        'Managed Security Reviewer',
                    'description' =>
                        'Managed role used to verify clone-before-edit protection.',
                    'scope_type' =>
                        'tenant',
                    'status' =>
                        'active',
                ]
            );

        $managedRole->permissions()
            ->syncWithoutDetaching([
                $managedPermission->id,
            ]);

        $this
            ->withHeader(
                'X-Tenant-Slug',
                $tenant->slug
            )
            ->withToken($token)
            ->putJson(
                "/api/v1/access-check/security/roles/{$managedRole->id}",
                [
                    'name' =>
                        $managedRole->name,
                    'permissions' =>
                        $managedRole
                            ->permissions()
                            ->pluck('code')
                            ->all(),
                ]
            )
            ->assertStatus(422);
    }

    private function ensurePermissions(
        array $codes
    ): void {
        foreach ($codes as $code) {
            Permission::query()
                ->updateOrCreate(
                    [
                        'code' => $code,
                    ],
                    [
                        'name' =>
                            str($code)
                                ->replace('.', ' ')
                                ->headline()
                                ->toString(),
                        'permission_group' =>
                            str_contains(
                                $code,
                                'procurement'
                            )
                                ? 'procurement'
                                : 'security',
                        'description' =>
                            'Test permission for role governance.',
                        'status' => 'active',
                    ]
                );
        }
    }

    private function loginAsSecurityAdministrator(): string
    {
        $tenant = Tenant::query()
            ->where(
                'slug',
                'vitapharma'
            )
            ->firstOrFail();

        $administrator = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->whereHas(
                'tenantAssignments',
                function ($query) use (
                    $tenant
                ): void {
                    $query
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'status',
                            'active'
                        );
                }
            )
            ->firstOrFail();

        $permission =
            Permission::query()
                ->firstOrCreate(
                    [
                        'code' =>
                            'tenant.roles.manage',
                    ],
                    [
                        'name' =>
                            'Manage roles',
                        'permission_group' =>
                            'security',
                        'description' =>
                            'Manage tenant roles and user access.',
                        'status' =>
                            'active',
                    ]
                );

        if (
            $permission->status
            !== 'active'
        ) {
            $permission
                ->forceFill([
                    'status' => 'active',
                ])
                ->save();
        }

        $role = Role::query()
            ->firstOrCreate(
                [
                    'code' =>
                        'test-role-governance-administrator',
                ],
                [
                    'name' =>
                        'Test Role Governance Administrator',
                    'description' =>
                        'Test-only role governance authorization.',
                    'scope_type' =>
                        'tenant',
                    'status' =>
                        'active',
                ]
            );

        $role->permissions()
            ->syncWithoutDetaching([
                $permission->id,
            ]);

        $administrator->roles()
            ->syncWithoutDetaching([
                $role->id => [
                    'tenant_id' =>
                        $tenant->id,
                    'solution_id' => null,
                    'branch_id' => null,
                    'status' => 'active',
                ],
            ]);

        return $this->loginAs(
            'admin@vitapharmaafrica.com'
        );
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Reporting Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }
}
